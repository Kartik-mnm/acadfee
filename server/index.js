require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Routes
app.use("/api/auth",       require("./routes/auth"));
app.use("/api/branches",   require("./routes/branches"));
app.use("/api/batches",    require("./routes/batches"));
app.use("/api/students",   require("./routes/students"));
app.use("/api/fees",       require("./routes/fees"));
app.use("/api/payments",   require("./routes/payments"));
app.use("/api/reports",    require("./routes/reports"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/tests",      require("./routes/tests"));
app.use("/api/expenses",   require("./routes/expenses"));
app.use("/api/qrscan",    require("./routes/qrscan"));

app.get("/", (_, res) => res.json({ status: "Nishchay Academy Fee API running" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
