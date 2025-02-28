const soap = require("soap");

soap.createClient("http://localhost:8000/products?wsdl", {}, function (err, client) {
  if (err) {
    console.error("Error creating SOAP client:", err);
    return;
  }

  // Appel à l'opération GetProducts pour récupérer tous les produits
  client.GetProducts({}, function (err, result) {
    if (err) {
      console.error("Error making SOAP request:", err);
      return;
    }
    console.log("Products:", result);
    // Afficher la liste des produits
    Object.values(result).forEach(product => {
      console.log(`Product ID: ${product.id}, Name: ${product.name}, About: ${product.about}, Price: ${product.price}`);
    });
  });
});
