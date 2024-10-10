const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Configuración de conexión
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

// Crear la base de datos y las tablas si no existen
const initDatabase = () => {
  // Verifica si la base de datos existe
  db.query('CREATE DATABASE IF NOT EXISTS blog_db', (err) => {
    if (err) throw err;
    console.log('Base de datos `blog_db` creada o ya existe.');

    // Selecciona la base de datos
    db.query('USE blog_db', (err) => {
      if (err) throw err;

      // Crea las tablas si no existen
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          email VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          profile_picture LONGBLOB,
          is_moderator BOOLEAN DEFAULT FALSE
        )
      `;

      const createPostsTable = `
        CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        image LONGBLOB,
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    const createCommentsTable = `
        CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content TEXT NOT NULL,
        image LONGBLOB,
        user_id INT,
        post_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (post_id) REFERENCES posts(id)
      )
    `;


      // Ejecuta las consultas para crear las tablas
      db.query(createUsersTable, (err) => {
        if (err) throw err;
        console.log('Tabla `users` creada o ya existe.');

        db.query(createPostsTable, (err) => {
          if (err) throw err;
          console.log('Tabla `posts` creada o ya existe.');

          db.query(createCommentsTable, (err) => {
            if (err) throw err;
            console.log('Tabla `comments` creada o ya existe.');
            db.end(); // Cierra la conexión
            
          });
        });
      });
    });
  });
};

initDatabase();
