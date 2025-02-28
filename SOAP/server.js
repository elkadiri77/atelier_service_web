const soap = require("soap");
const fs = require("node:fs");
const http = require("http");
const postgres = require("postgres");

const sql = postgres({ db: "mydb", user: "user", password: "user" });

// Définition du service avec les nouvelles opérations
const service = {
  ProductsService: {
    ProductsPort: {
      // Opération pour créer un produit
      CreateProduct: async function ({ name, about, price }, callback) {
        if (!name || !about || !price) {
          throw {
            Fault: {
              Code: { Value: "soap:Sender", Subcode: { value: "rpc:BadArguments" } },
              Reason: { Text: "Processing Error" },
              statusCode: 400,
            },
          };
        }

        const product = await sql`
          INSERT INTO products (name, about, price)
          VALUES (${name}, ${about}, ${price})
          RETURNING *`;

        callback(product[0]);
      },

      // Opération pour obtenir tous les produits
      GetProducts: async function (args, callback) {
        const products = await sql`SELECT * FROM products`;
        callback(products);
      },

      // Opération pour mettre à jour un produit partiellement (Patch)
      PatchProduct: async function ({ id, name, about, price }, callback) {
        if (!id) {
          throw {
            Fault: {
              Code: { Value: "soap:Sender", Subcode: { value: "rpc:BadArguments" } },
              Reason: { Text: "Product ID is required" },
              statusCode: 400,
            },
          };
        }

        // Mettre à jour le produit uniquement si les valeurs sont présentes
        const updateFields = [];
        const updateValues = [];

        if (name) {
          updateFields.push("name = ${name}");
          updateValues.push(name);
        }
        if (about) {
          updateFields.push("about = ${about}");
          updateValues.push(about);
        }
        if (price) {
          updateFields.push("price = ${price}");
          updateValues.push(price);
        }

        if (updateFields.length === 0) {
          throw {
            Fault: {
              Code: { Value: "soap:Sender", Subcode: { value: "rpc:BadArguments" } },
              Reason: { Text: "No valid fields provided for update" },
              statusCode: 400,
            },
          };
        }

        // Mise à jour du produit dans la base de données
        const product = await sql`
          UPDATE products
          SET ${sql(updateFields)}
          WHERE id = ${id}
          RETURNING *`;

        if (product.length === 0) {
          throw {
            Fault: {
              Code: { Value: "soap:Receiver", Subcode: { value: "rpc:ProductNotFound" } },
              Reason: { Text: "Product not found" },
              statusCode: 404,
            },
          };
        }

        callback(product[0]);
      },

      // Opération pour supprimer un produit
      DeleteProduct: async function ({ id }, callback) {
        if (!id) {
          throw {
            Fault: {
              Code: { Value: "soap:Sender", Subcode: { value: "rpc:BadArguments" } },
              Reason: { Text: "Product ID is required" },
              statusCode: 400,
            },
          };
        }

        // Suppression du produit dans la base de données
        const result = await sql`
          DELETE FROM products WHERE id = ${id} RETURNING *`;

        if (result.length === 0) {
          throw {
            Fault: {
              Code: { Value: "soap:Receiver", Subcode: { value: "rpc:ProductNotFound" } },
              Reason: { Text: "Product not found" },
              statusCode: 404,
            },
          };
        }

        callback({ success: true });
      },
    },
  },
};

// Serveur HTTP
const server = http.createServer(function (request, response) {
  response.end("404: Not Found: " + request.url);
});

server.listen(8000);

// Créer le serveur SOAP
const xml = fs.readFileSync("productsService.wsdl", "utf8");
soap.listen(server, "/products", service, xml, function () {
  console.log("SOAP server running at http://localhost:8000/products?wsdl");
});
