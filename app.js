const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const dbPath = path.join(__dirname, "taskmanagement.db");
let db= null;

//connect to database
const dbase=new sqlite3.Database('./taskmanagement.db',sqlite3.OPEN_READWRITE,(err)=>{
    if(err) return console.log(err.message)
});

//creating tables
sql=`CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT,role TEXT);`;
sql2=`CREATE TABLE Tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, status TEXT, assignee_id INTEGER, created_at DATETIME, updated_at DATETIME, FOREIGN KEY(assignee_id) REFERENCES Users(id));`;



const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4000, () => {
      console.log("Server running at http://localhost:4000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

app.use(bodyParser.json())

const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "secret", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.payload = payload;
          console.log(payload)
          next();
        }
      });
    }
  };
//api1 -Registering the user which can be HR or Employee
app.post("/registeruser/", async (request, response) => {
    const { username,password,role } = request.body;
    console.log(username,password);
    const getUserDetailsQuery = `
      SELECT 
       *
      FROM 
       Users
      WHERE 
       username='${username}'
      `;
    const getUserDetails = await db.get(getUserDetailsQuery);
    if (getUserDetails !== undefined) {
      response.status(400);
      response.send("User already exists");
    } else {
      if (password.length < 5) {
        response.status(400);
        response.send("Password is too short");
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const addUser = `
              INSERT INTO
               Users(username,password_hash,role)
              VALUES 
               ('${username}','${hashedPassword}','${role}')`;
        await db.run(addUser);
        response.status(200);
        response.send("User created successfully");
      }
    }
  });
//api2-Logging to the portal and getting the jsonwebtoken
app.post("/login/", async (request, response) => {
    const { username, password } = request.body;
    const getUserDetailsQuery = `
      SELECT * FROM Users WHERE username='${username}'
      `;
      const getUserDetails = await db.get(getUserDetailsQuery);
      const isPasswordsMatch = await bcrypt.compare(
        password,
        getUserDetails.password_hash
      );
      if (isPasswordsMatch) {
        const jwtToken = jwt.sign(getUserDetails, "secret");
        console.log(jwtToken);
        response.send({ jwtToken });
      } else {
        response.status(400);
        response.send("Invalid password");
      }
});
//api3-Creating a Task only by a HR
app.post('/createtask/',authenticateToken,async (request, response)=>{
    const{title,description,status,assigneeId}=request.body
    const {payload}=request
    const {role}=payload
    if(role==="HR"){
        const currentDate = new Date();
        const formattedDateTime = currentDate.toISOString().slice(0, 19).replace('T', ' ');
        const addTask=`
         INSERT INTO Tasks(title,description,status,assignee_id,created_at,updated_at)
         VALUES ('${title}','${description}','${status}',${assigneeId},'${formattedDateTime}','${formattedDateTime}');
        `
        await db.run(addTask);
        response.status(200);
        response.send("Task created successfully");
    }
    else{
        response.status(400)
        response.send("Only Hrs can create tasks")
    }
});
//api4-Retrieving all tasks by a specific employee
app.get('/mytasks/:id',authenticateToken,async(request,response)=>{
    const {role}=request.payload
    const {id}=request.params
    console.log(id);
    if(role==="Employee"){
      const getTasksQuery=`SELECT * FROM Tasks WHERE assignee_id=${id}
      `
      const detailsTasks = await db.all(getTasksQuery)
      response.status(200)
      response.send(detailsTasks);
    }
});
//api5-Retrieving all tasks
app.get('/tasks',async(request,response)=>{
  const getAllTasksQuery=`
  SELECT * FROM Tasks;`
  const getAllTasks=await db.all(getAllTasksQuery)
  response.status(200)
  response.send(getAllTasks)
})
//api6-Retrieving a specific task by ID
app.get('/tasks/:id',async(request,response)=>{
  const {id}=request.params
  const getTaskQuery=`
  SEELECT * FROM Tasks WHERE id=${id}`
  const getTask=await db.get(getTaskQuery)
  response.status(200)
  response.send(getTask)
})
//api7-Updating a Specific Task by ID
app.put('/updatestatus/:taskid',authenticateToken,async(request,response)=>{
  const {taskid}=request.params
  const {status}=request.body
  const {role}=request.payload
  if(role==='Employee'){
    const currentDate = new Date();
    const formattedDateTime = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    const updateTaskQuery=`
    UPDATE Tasks 
    SET status='${status}', updated_at='${formattedDateTime}'
    WHERE id=${taskid}`
    await db.run(updateTaskQuery)
    response.status(200)
    response.send("Status updated")
  }
  else{
    response.status(400)
    response.send("Hr cannot change the status")
  }
})
//api8-Deleting a specific Task by ID
app.delete('/tasks/:id',authenticateToken,async(request,response)=>{
  const {id}=request.params
  const {role}=request.payload
  if(role==='HR'){
  const deleteTaskQuery=`
  DELETE FROM Tasks WHERE id=${id};`
  await db.run(deleteTaskQuery)
  response.status(200)
  response.send("Task Deleted Successfully")
  }
  else{
    response.status(400)
    response.send("Employee cannot delete")
  }
})