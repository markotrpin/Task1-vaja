
const express = require('express');
const app = express();

const  mongoose = require('mongoose');

const bodyParser = require('body-parser');

const { List, Task, User} = require('./models/index');

const jwt = require('jsonwebtoken');

mongoose.connect('mongodb+srv://marko:cbspSbo7M7tIVvh3@cluster0.x53kw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority')
.then(()=> {
  console.log('conected to DB successfully');
})
.catch(()=>{
  console.log('conection fail');
});

// pass: cbspSbo7M7tIVvh3

/* mongoose.connect('mongodb+srv://gringo:X3CgP1LByPNNGWWY@cluster0.coz8i.mongodb.net/myFirstDatabase?retryWrites=true&w=majority')
.then(()=> {
  console.log('conected to DB');
})
.catch(()=>{
  console.log('conection fail');
}); */

/* MIDDLEWARE */

app.use(bodyParser.json());

app.use((req, res, next)=>{
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id');

  res.header(
    'Access-Control-Expose-Headers',
    'x-access-token, x-refresh-token'
);

  next();
});


// check whether request has a valid JWT access token
let authenticate = (req, res, next) => {
  let token = req.header('x-access-token');

  // verify the JWT
  jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
      if (err) {
          // there was an error
          // jwt is invalid - * DO NOT AUTHENTICATE *
          res.status(401).send(err);
      } else {
          // jwt is valid
          req.user_id = decoded._id;
          next();
      }
  });
}



// Verify Refresh Token Middleware (which will be verifying the session)
let verifySession = (req, res, next) => {
  // grab the refresh token from the request header
  let refreshToken = req.header('x-refresh-token');

  // grab the _id from the request header
  let _id = req.header('_id');

  User.findByIdAndToken(_id, refreshToken).then((user) => {
      if (!user) {
          // user couldn't be found
          return Promise.reject({
              'error': 'User not found. Make sure that the refresh token and user id are correct'
          });
      }


      // if the code reaches here - the user was found
      // therefore the refresh token exists in the database - but we still have to check if it has expired or not

      req.user_id = user._id;
      req.userObject = user;
      req.refreshToken = refreshToken;

      let isSessionValid = false;

      user.sessions.forEach((session) => {
          if (session.token === refreshToken) {
              // check if the session has expired
              if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                  // refresh token has not expired
                  isSessionValid = true;
              }
          }
      });

      if (isSessionValid) {
          // the session is VALID - call next() to continue with processing this web request
          next();
      } else {
          // the session is not valid
          return Promise.reject({
              'error': 'Refresh token has expired or session is invalid'
          })
      }

  }).catch((e) => {
      res.status(401).send(e);
  })
}

/* END MIDDLEWARE  */



/* Route handlers */

/* LIST ROUTES */


/* GET /lists -
  get all lists */


  app.get('/lists', authenticate, (req, res) => {
    // We want to return an array of all the lists that belong to the authenticated user
    List.find({
        _userId: req.user_id
    }).then((lists) => {
        res.send(lists);
    }).catch((e) => {
        res.send(e);
    });
})


  /* POST /lists -
  create list */

app.post('/lists',authenticate, (req,res,next) =>{
    // create new list and return new list document to user with ID
    let title = req.body.title;

    let newList = new List({
      title,
      _userId: req.user_id
    });
    newList.save().then((listDoc)=>{
      //full list document is returned with id
      res.send(listDoc);

    })
  });

      /* PATCH /lists -
    update list */
  app.patch('/lists/:id', (req,res,next) =>{
    // update list
    List.findOneAndUpdate({ _id: req.params.id, _userId: req.user_id}, {
      $set: req.body
    }).then(()=>{
      res.send({ 'message': 'updated successfull'});
    });
  });


   /* DELETE /lists -
    delete list */
  app.delete('/lists/:id',authenticate, (req,res,next) =>{
    // delete list
    List.findOneAndRemove({
      _id: req.params.id,
      _userId: req.user_id
    }).then((removedListDoc)=>{
      res.send(removedListDoc);

      // delete all the tasks that are in the deleted list
      deleteTasksFromList(removedListDoc._id);
    })
  });




  /* GET  /lists/:listId/tasks
get all tasks in specific list*/

app.get('/lists/:listId/tasks',authenticate, (req,res,next) =>{
  //return all tasks that belong to specific list
  Task.find({
    _listId: req.params.listId
  }).then((tasks)=>{
    res.send(tasks);
  })
});




/* POST /lists/:listId/tasks
create new task ins spec. list*/

app.post('/lists/:listId/tasks',authenticate, (req,res,next)=>{
  //create a new task in a list specified by listid

  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id
  }).then((list) => {
    if (list) {
        // list object with the specified conditions was found
        // therefore the currently authenticated user can create new tasks
        return true;
    }
    // else - the list object is undefined
    return false;

  }).then((canCreateTask) => {
    if (canCreateTask) {
        let newTask = new Task({
            title: req.body.title,
            _listId: req.params.listId
        });
        newTask.save().then((newTaskDoc) => {
            res.send(newTaskDoc);
        })
    } else {
        res.sendStatus(404);
    }
})
})

/* PATCH  /lists/:listId/tasks/:taskId
*/
app.patch('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {
  // We want to update an existing task (specified by taskId)

  List.findOne({
      _id: req.params.listId,
      _userId: req.user_id
  }).then((list) => {
      if (list) {
          // list object with the specified conditions was found
          // therefore the currently authenticated user can make updates to tasks within this list
          return true;
      }

      // else - the list object is undefined
      return false;
  }).then((canUpdateTasks) => {
      if (canUpdateTasks) {
          // the currently authenticated user can update tasks
          Task.findOneAndUpdate({
              _id: req.params.taskId,
              _listId: req.params.listId
          }, {
                  $set: req.body
              }
          ).then(() => {
              res.send({ message: 'Updated successfull.' })
          })
      } else {
          res.sendStatus(404);
      }
  })
});


/* DELETE  /lists/:listId/tasks/:taskId
delete task
*/
app.delete('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {

  List.findOne({
      _id: req.params.listId,
      _userId: req.user_id
  }).then((list) => {
      if (list) {
          // list object with the specified conditions was found
          // therefore the currently authenticated user can make updates to tasks within this list
          return true;
      }

      // else - the list object is undefined
      return false;
  }).then((canDeleteTasks) => {

      if (canDeleteTasks) {
          Task.findOneAndRemove({
              _id: req.params.taskId,
              _listId: req.params.listId
          }).then((removedTaskDoc) => {
              res.send(removedTaskDoc);
          })
      } else {
          res.sendStatus(404);
      }
  });
});

/* USER ROUTES */

/* SIGNUP ROUTE
 POST /users  */

 app.post('/users', (req, res) => {
  // User sign up

  let body = req.body;
  let newUser = new User(body);

  newUser.save().then(() => {
      return newUser.createSession();
  }).then((refreshToken) => {
      // Session created successfully - refreshToken returned.
      // now we generate an access auth token for the user

      return newUser.generateAccessAuthToken().then((accessToken) => {
          // access auth token generated successfully, now we return an object containing the auth tokens
          return { accessToken, refreshToken }
      });
  }).then((authTokens) => {
      // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
      res
          .header('x-refresh-token', authTokens.refreshToken)
          .header('x-access-token', authTokens.accessToken)
          .send(newUser);
  }).catch((e) => {
      console.log(e);
      res.status(400).send(e);
  })
})

/* LOGIN ROUTE
 POST /users/login  */

 app.post('/users/login', (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  User.findByCredentials(email, password).then((user) => {
      return user.createSession().then((refreshToken) => {
          // Session created successfully - refreshToken returned.
          // now we geneate an access auth token for the user

          return user.generateAccessAuthToken().then((accessToken) => {
              // access auth token generated successfully, now we return an object containing the auth tokens
              return { accessToken, refreshToken }
          });
      }).then((authTokens) => {
          // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
          res
              .header('x-refresh-token', authTokens.refreshToken)
              .header('x-access-token', authTokens.accessToken)
              .send(user);
      })
  }).catch((e) => {
      res.status(400).send(e);
  });
})



/* generates and returns an access token route
 GET users/me/access-token  */

 app.get('/users/me/access-token', verifySession, (req, res) => {
  // we know that the user/caller is authenticated and we have the user_id and user object available to us
  req.userObject.generateAccessAuthToken().then((accessToken) => {
      res.header('x-access-token', accessToken).send({ accessToken });
  }).catch((e) => {
      res.status(400).send(e);
  });
})


/* HELPER METHODS */
let deleteTasksFromList = (_listId) => {
  Task.deleteMany({
      _listId
  }).then(() => {
      console.log("Tasks from " + _listId + " were deleted!");
  })
}


module.exports = app;

/* app.listen(process.env.PORT || 3000, ()=> {
    console.log('Server is listening');
  }) */
