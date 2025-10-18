const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My API Documentation",
      version: "1.0.0",
      description: `
        This is the official documentation for the REST API.
        <br><br>
        **Environment:**  
        - 🧪 Development → http://localhost:5000  
        - 🚀 Production → https://api.yourdomain.com  
      `,
      contact: {
        name: "Backend Team",
        email: "dev@yourdomain.com",
      },
    },

    // 👇 Multiple environment servers
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
      {
        url: "https://api.yourdomain.com",
        description: "Production server",
      },
    ],

    // 👇 Components: schemas + security
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
            id: { type: "string", example: "64b2e9d2f1b0c12345abc678" },
            email: { type: "string", example: "user@example.com" },
            name: { type: "string", example: "John Doe" },
          },
        },
      },
    },

    // 👇 Apply bearerAuth globally (optional)
    security: [
      {
        bearerAuth: [],
      },
    ],
  },

  // 👇 Paths to route files for Swagger annotations
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsDoc(options);

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log("✅ Swagger Docs available at /api-docs");
}

module.exports = setupSwagger;
