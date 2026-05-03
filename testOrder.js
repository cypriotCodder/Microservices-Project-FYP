const axios = require('axios');

async function run() {
  try {
    const res = await axios.post('http://localhost:4000/orders', {
      userId: "1",
      totalAmount: 100,
      products: [{ productId: 1, quantity: 1 }]
    });
    console.log("Create Monolith:", res.data);
    
    const buyRes = await axios.post(`http://localhost:4000/orders/${res.data.order.id}/buy`);
    console.log("Buy Monolith:", buyRes.data);
  } catch(e) {
    console.error("Monolith error:", e.response ? e.response.data : e.message);
  }
}
run();
