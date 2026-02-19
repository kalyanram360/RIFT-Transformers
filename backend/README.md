# Backend API

A clean Node.js Express backend with organized structure.

## Project Structure

```
backend/
├── index.js              # Main server entry point
├── package.json          # Project dependencies
├── .env                  # Environment variables
├── .gitignore            # Git ignore file
├── controllers/          # Business logic
│   └── userController.js # User controller with handlers
├── routes/               # Route definitions
│   └── userRoutes.js     # User routes
└── middleware/           # Custom middleware (if needed)
```

## Installation

```bash
npm install
```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload (requires nodemon)

## API Endpoints

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create a new user

## Example Usage

```bash
# Get all users
curl http://localhost:5000/api/users

# Get user by ID
curl http://localhost:5000/api/users/1

# Create a new user
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'
```

## Environment Variables

Create a `.env` file with:

```
PORT=5000
NODE_ENV=development
```
