const http = require("http");

const payload = JSON.stringify({
  totalAmount: 109.00,
  paymentMethod: "CASH",
  subTotal: 100.00,
  taxAmount: 9.00,
  discountAmount: 0,
  discountType: "fixed",
  roundOff: 0,
  orderType: "DINE-IN",
  tableNo: "T1",
  items: [
    {
      dish_name: "Mala - Oviya",
      qty: 1,
      price: 50.00,
      status: "NORMAL"
    },
    {
      dish_name: "Mala - Rambha",
      qty: 1,
      price: 50.00,
      status: "NORMAL"
    }
  ],
  payments: [
    {
      payMode: "CASH",
      amount: 109.00
    }
  ]
});

const jwt = require("jsonwebtoken");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const token = jwt.sign(
  { userId: "USR0698703132", userName: "OWNER", role: "ADMIN" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

const req = http.request(
  {
    hostname: "localhost",
    port: 5000,
    path: "/api/sales/save",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Length": Buffer.byteLength(payload)
    }
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Response: ${data}`);
      process.exit(0);
    });
  }
);

req.on("error", (e) => {
  console.error("Request error:", e.message);
  process.exit(1);
});

req.write(payload);
req.end();
