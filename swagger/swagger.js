const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Splita Backend API Documentation",
      version: "1.0.0",
      description: `
        This is the official documentation for Splita Api.
        Here, you'll find all the information you need to effectively interact with our API endpoints.
      `,
      contact: {
        name: "Backend Team",
        email: "tfelix205@gmail.com",
      },
    },

   
    servers: [
      {
        url: "http://localhost:6789",
        description: "Development server",
      },
      {
        url: "https://splita.onrender.com",
        description: "Production server",
      },
    ],

    // Components: schemas + security
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token (without 'Bearer' prefix)",
        },
      },
      schemas: {
        // Reusable schema example
        User: {
          type: "object",
          properties: {
            id: { type: Number, example: "64" },
            email: { type: "string", example: "user@example.com" },
            name: { type: "string", example: "chidera adankpa" },
          },
        },
      },
    },

    //  Apply bearerAuth globally (optional)
    security: [
      {
        bearerAuth: [],
      },
    ],
  },

  //  Paths to route files for Swagger annotations
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsDoc(options);

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log("✅ Swagger Docs available at /api-docs");
}

module.exports = setupSwagger;
