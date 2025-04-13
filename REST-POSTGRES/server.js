const express = require("express");
const postgres = require("postgres");
const { z } = require("zod");
const crypto = require("crypto");
const fetch = require("node-fetch");



const app = express();
const port = 8000;

// Connexion à la base de données
const sql = postgres({ db: "mydb", user: "rest", password: "rest" });

// Middleware pour parser le corps des requêtes en JSON
app.use(express.json());

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

// Schemas
const ProductSchema = z.object({
    id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
  });
  const CreateProductSchema = ProductSchema.omit({ id: true });
  

  const UserSchema = z.object({
    id: z.number(),
    username: z.string(),
    password: z.string(),
    email: z.string().email()
  });
  
  const CreateUserSchema = UserSchema.omit({ id: true });


  // Route GET /products/:id - Récupérer un produit par son ID
app.get("/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await sql`SELECT * FROM products WHERE id = ${id}`;
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Produit non trouvé" });
      }
      
      res.json(result[0]);
    } catch (error) {
      res.status(404).send({ message: "Not found" });    }
  });
  
  // Route GET /products - Récupérer tous les produits avec pagination
  app.get("/products", async (req, res) => {
    const page = parseInt(req.query.page) || 1;  // Page de la requête (par défaut page 1)
    const limit = parseInt(req.query.limit) || 10;  // Nombre d'éléments par page (par défaut 10)
    const offset = (page - 1) * limit;  // Calculer l'offset pour la pagination
  
    try {
      const products = await sql`SELECT * FROM products LIMIT ${limit} OFFSET ${offset}`;
      
      if (products.length === 0) {
        return res.status(404).json({ error: "Aucun produit trouvé" });
      }
      
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la récupération des produits" });
    }
  });

  
  
  app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);
  
    // If Zod parsed successfully the request body
    if (result.success) {
      const { name, about, price } = result.data;
  
      const product = await sql`
      INSERT INTO products (name, about, price)
      VALUES (${name}, ${about}, ${price})
      RETURNING *
      `;
  
      res.send(product[0]);
    } else {
      res.status(400).send(result);
    }
  });

// Route de test Hello World
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.delete("/products/:id", async (req, res) => {
  const product = await sql`
    DELETE FROM products
    WHERE id=${req.params.id}
    RETURNING *
    `;

  if (product.length > 0) {
    res.send(product[0]);
  } else {
    res.status(404).send({ message: "Not found" });
  }
});


// ------------------------------------ Users ------------------------------------ //
// Route PUT /users/:id - Mettre à jour toutes les informations de l'utilisateur
app.put("/users/:id", async (req, res) => {
  const { id } = req.params;
  const result = CreateUserSchema.safeParse(req.body);
  
  if (result.success) {
    const { username, password, email } = result.data;
    let updateQuery = `UPDATE users SET `;
    const values = [];
    
    if (username) {
      updateQuery += `username = $${values.length + 1}, `;
      values.push(username);
    }
    
    if (password) {
      updateQuery += `password = $${values.length + 1}, `;
      values.push(hashPassword(password));
    }
    
    if (email) {
      updateQuery += `email = $${values.length + 1}, `;
      values.push(email);
    }
    
    // Enlève la virgule à la fin de la requête
    updateQuery = updateQuery.slice(0, -2);
    
    updateQuery += ` WHERE id = $${values.length + 1} RETURNING *`;
    values.push(id);

    try {
      const updatedUser = await sql`
        ${sql.raw(updateQuery, ...values)}
      `;
      
      if (updatedUser.length === 0) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      res.json(updatedUser[0]);
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur" });
    }
  } else {
    res.status(400).json(result.error.errors);
  }
});

// Route PATCH /users/:id - Mettre à jour partiellement l'utilisateur
app.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const result = CreateUserSchema.safeParse(req.body);
  
  if (result.success) {
    const { username, password, email } = result.data;
    let updateQuery = `UPDATE users SET `;
    const values = [];
    
    if (username) {
      updateQuery += `username = $${values.length + 1}, `;
      values.push(username);
    }
    
    if (password) {
      updateQuery += `password = $${values.length + 1}, `;
      values.push(hashPassword(password));
    }
    
    if (email) {
      updateQuery += `email = $${values.length + 1}, `;
      values.push(email);
    }
    
    if (values.length === 0) {
      return res.status(400).json({ error: "Aucune donnée à mettre à jour" });
    }
    
    // Enlève la virgule à la fin de la requête
    updateQuery = updateQuery.slice(0, -2);
    
    updateQuery += ` WHERE id = $${values.length + 1} RETURNING *`;
    values.push(id);

    try {
      const updatedUser = await sql`
        ${sql.raw(updateQuery, ...values)}
      `;
      
      if (updatedUser.length === 0) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      res.json(updatedUser[0]);
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la mise à jour partielle de l'utilisateur" });
    }
  } else {
    res.status(400).json(result.error.errors);
  }
});

// -------------------------- exercice 2 ----------------------------
// Endpoint pour récupérer la liste des jeux Free-to-Play
app.get("/f2p-games", async (req, res) => {
  try {
    // Récupérer la liste des jeux depuis l'API FreeToGame
    const response = await fetch("https://api.free-to-play.com/api/games");
    const data = await response.json();

    // Vérifie si l'API a renvoyé des données valides
    if (!data || !Array.isArray(data)) {
      return res.status(500).json({ error: "Erreur lors de la récupération des jeux" });
    }

    // Envoie les jeux au client
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la connexion au service FreeToGame" });
  }
});

// Endpoint pour récupérer un jeu spécifique par ID
app.get("/f2p-games/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Récupérer le jeu spécifique par ID depuis l'API FreeToGame
    const response = await fetch(`https://api.free-to-play.com/api/games/${id}`);
    const game = await response.json();

    // Vérifie si le jeu a été trouvé
    if (!game) {
      return res.status(404).json({ error: "Jeu non trouvé" });
    }

    // Envoie les données du jeu au client
    res.json(game);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la connexion au service FreeToGame" });
  }
});


// Démarrer le serveur
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
