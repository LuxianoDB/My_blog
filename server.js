const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const path = require('path');

//Foto
const fs = require('fs');
//const path = require('path');

//Config foto
const fileUpload = require('express-fileupload');

// Requiere el script de inicialización
require('./init-db');

const app = express();
const port = 3000;

// Configura la conexión a la base de datos
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'blog_db'
});

// Verifica si la conexión está bien
db.connect(err => {
  if (err) throw err;
  console.log('Conectado a MySQL');
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));
app.use(fileUpload());

app.use(session({
  secret: 'secreta',
  resave: false,
  saveUninitialized: true
}));

// Middleware de autenticación
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Rutas y lógica del servidor
app.get('/', async (req, res) => {
  db.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 1', (err, results) => {
    if (err) throw err;
    res.render('index', { post: results[0], user: req.session.user });
  });
});

app.get('/posts', (req, res) => {
  db.query('SELECT * FROM posts ORDER BY created_at DESC', (err, results) => {
    if (err) throw err;
    res.render('posts', { posts: results, user: req.session.user });
  });
});

app.get('/admin', isAuthenticated, (req, res) => {
  if (req.session.user.is_moderator) {
    db.query('SELECT * FROM posts ORDER BY created_at DESC', (err, results) => {
      if (err) throw err;
      res.render('admin', { posts: results, user: req.session.user });
    });
  } else {
    res.redirect('/');
  }
});

app.post('/create-post', isAuthenticated, (req, res) => {
  const { title, content } = req.body;
  let image = null;

  if (req.files && req.files.image) {
    image = req.files.image.data; // Extraemos los datos binarios de la imagen
  }

  db.query('INSERT INTO posts (title, content, image, user_id) VALUES (?, ?, ?, ?)', [title, content, image, req.session.user.id], (err) => {
    if (err) throw err;
    res.redirect('/posts');
  });
});


app.post('/edit-post/:id', isAuthenticated, (req, res) => {
  const { title, content, remove_image } = req.body;
  let query = 'UPDATE posts SET title = ?, content = ? WHERE id = ? AND user_id = ?';
  let params = [title, content, req.params.id, req.session.user.id];
  
  // Si el usuario sube una nueva imagen
  if (req.files && req.files.image) {
    const image = req.files.image.data;
    query = 'UPDATE posts SET title = ?, content = ?, image = ? WHERE id = ? AND user_id = ?';
    params = [title, content, image, req.params.id, req.session.user.id];
  }

  // Si se selecciona eliminar la imagen
  if (remove_image) {
    query = 'UPDATE posts SET title = ?, content = ?, image = NULL WHERE id = ? AND user_id = ?';
    params = [title, content, req.params.id, req.session.user.id];
  }

  db.query(query, params, (err) => {
    if (err) throw err;
    res.redirect('/admin');
  });
});


app.post('/delete-post/:id', isAuthenticated, (req, res) => {
  const postId = req.params.id;
  const userId = req.session.user.id;

  // Primero eliminar los comentarios asociados al post
  db.query('DELETE FROM comments WHERE post_id = ?', [postId], (err) => {
    if (err) throw err;

    // Después eliminar el post
    db.query('DELETE FROM posts WHERE id = ? AND user_id = ?', [postId, userId], (err) => {
      if (err) throw err;
      res.redirect('/');
    });
  });
});


app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) throw err;
    if (results.length > 0 && bcrypt.compareSync(password, results[0].password)) {
      req.session.user = results[0];
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);

  const defaultImagePath = path.join(__dirname, 'public', 'imgs', 'default.png');
  const defaultImageBuffer = fs.readFileSync(defaultImagePath);
  db.query('INSERT INTO users (username, email, password, profile_picture) VALUES (?, ?, ?, ?)', [username, email, hashedPassword, defaultImageBuffer], (err) => {
    if (err) throw err;
    res.redirect('/login');
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) throw err;
    res.redirect('/');
  });
});

// Endpoint para obtener la imagen
app.get('/profile-picture/:id', (req, res) => {
  const userId = req.params.id;
  db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (error, results) => {
      if (error) {
          return res.status(500).send('Error al consultar la base de datos');
      }

      if (results.length > 0) {
          const img = results[0].profile_picture;
          res.writeHead(200, {
              'Content-Type': 'image/png', // o 'image/png', según tu caso
              'Content-Length': img.length
          });
          res.end(img);
      } else {
          res.status(404).send('Imagen no encontrada');
      }
  });
});

app.get('/configurar-perfil', isAuthenticated, (req, res) => {
  res.render('configurar-perfil', { user: req.session.user });
});

app.post('/configurar-perfil', isAuthenticated, (req, res) => {
  const { username } = req.body;
  let query = 'UPDATE users SET username = ? WHERE id = ?';
  let params = [username, req.session.user.id];

  // Si el usuario envía una nueva imagen de perfil
  if (req.files && req.files.profile_picture) {
    const profilePicture = req.files.profile_picture.data;
    query = 'UPDATE users SET username = ?, profile_picture = ? WHERE id = ?';
    params = [username, profilePicture, req.session.user.id];
  }

  db.query(query, params, (err) => {
    if (err) throw err;
    // Actualizar la sesión con el nuevo nombre de usuario
    req.session.user.username = username;
    res.redirect('/');
  });
});

app.post('/comment/:postId', isAuthenticated, (req, res) => {
  const { content } = req.body;
  let image = null;

  // Si hay una imagen adjunta, la guardamos
  if (req.files && req.files.image) {
    image = req.files.image.data;
  }

  db.query('INSERT INTO comments (content, image, user_id, post_id) VALUES (?, ?, ?, ?)', [content, image, req.session.user.id, req.params.postId], (err) => {
    if (err) throw err;
    res.redirect(`/post/${req.params.postId}`);
  });
});

app.get('/post/:id', (req, res) => {
  db.query('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, postResults) => {
    if (err) throw err;
    
    if (postResults.length === 0) {
      return res.status(404).send('Post no encontrado');
    }

    // Consulta para obtener los comentarios y unir con los usuarios
    db.query('SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE post_id = ?', [req.params.id], (err, commentResults) => {
      if (err) throw err;

      // Renderizar la página y pasar los datos
      res.render('post', {
        post: postResults[0],
        comments: commentResults,
        user: req.session.user
      });
    });
  });
});



app.listen(3000, () => {
  console.log("Corriendo en el puerto 3000")
})
