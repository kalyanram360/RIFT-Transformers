// Get all users
const getUsers = (req, res) => {
  try {
    const users = [
      { id: 1, name: "John Doe", email: "john@example.com" },
      { id: 2, name: "Jane Smith", email: "jane@example.com" },
    ];
    res.status(200).json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

// Get user by ID
const getUserById = (req, res) => {
  try {
    const { id } = req.params;
    const user = { id, name: "John Doe", email: "john@example.com" };
    res.status(200).json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};

// Create user
const createUser = (req, res) => {
  try {
    const { name, email } = req.body;
    const newUser = { id: 3, name, email };
    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
};
