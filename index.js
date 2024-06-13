const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('colors')
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const cors = require('cors');

// middleware
app.use(cors())
app.use(express.json());

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0269g6x.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// middleware (verify jwt)
function verifyJwt(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).send({ message: 'unauthorized user', statusCode: 401 });
  }

  const token = header.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
    if (error) {
      return res.status(403).send({ message: 'forbidden access', statusCode: 403 })
    }

    req.decoded = decoded;
    next()
  })
};


async function run() {
  try {
    await client.connect();
    console.log('DB connection'.yellow.italic)
  }
  finally {

  }
}
run().catch(error => { console.log(error.name.bgRed, error.message.bold) })

// --------------------------- collection --------------------------->
const usersCollection = client.db('usedProductResale').collection('users');
const categoriesCollection = client.db('usedProductResale').collection('categories');
const productsCollection = client.db('usedProductResale').collection('products');
const ordersCollection = client.db('usedProductResale').collection('orders');
const sellersCollection = client.db('usedProductResale').collection('sellers');
const paymentsCollection = client.db('usedProductResale').collection('payments');



const verifyAdmin = async (req, res, next) => {
  const decodedEmail = req.decoded.email;
  const email = req.query.email;
  if (decodedEmail !== email) {
    return res.status(403).send({ message: 'forbidden access' })
  }

  const query = { email };
  const user = await usersCollection.findOne(query);
  if (user?.role !== "admin") {
    return res.status(403).send({ message: 'forbidden access' })
  }

  next();
};

const verifySeller = async (req, res, next) => {
  const decodedEmail = req.decoded.email;
  const email = req.query.email;

  if (decodedEmail !== email) {
    return res.status(403).send({ message: 'forbidden access' })
  }

  const query = { email };
  const user = await usersCollection.findOne(query);
  if (user?.role !== "Seller") {
    return res.status(403).send({ message: 'forbidden access' })
  }

  next();
};

const verifyBuyer = async (req, res, next) => {
  const decodedEmail = req.decoded.email;
  const email = req.query.email;

  if (decodedEmail !== email) {
    return res.status(403).send({ message: 'forbidden access' })
  }

  const query = { email };
  const user = await usersCollection.findOne(query);
  if (user?.role !== "Buyer") {
    return res.status(403).send({ message: 'forbidden access' })
  }

  next();
};



// # users
app.post('/users', async (req, res) => { // store user info in Data base
  const user = req.body;
  const email = (user.email);
  const query = { email }
  const reqEmail = await usersCollection.findOne(query);
  if (!reqEmail) {
    const result = await usersCollection.insertOne(user);
    res.send(result);
  }
  else {
    res.send({ acknowledged: true })
  }
});

app.get('/jwt', async (req, res) => {
  const email = req.query.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);

  if (user) {
    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '20d' });
    return res.send({ accessToken: token });
  }

  res.status(403).send({ accessToken: '' });
});


// categories
app.get('/categories', async (req, res) => {
  const query = {};
  const result = await categoriesCollection.find(query).toArray();
  res.send(result)
});

app.get('/category/:id', async (req, res) => {
  const id = req.params.id;
  const query = { categoryId: id, available: true }
  const result = await productsCollection.find(query).toArray();
  res.send(result);
});


// -------> products
app.get('/allProducts', async(req, res) => {
  const query = {};
  const result = await productsCollection.find(query).toArray();
  res.send(result);
});

app.post('/product', verifyJwt, async (req, res) => {
  const data = req.body;
  // console.log(data);
  const result = await productsCollection.insertOne(data);
  res.send(result);
});

app.get('/myProducts', verifyJwt, verifySeller, async (req, res) => {
  const email = req.query.email;
  const query = { sellerEmail: email };
  const result = await productsCollection.find(query).toArray();
  res.send(result);
});

app.put('/products/:id', verifyJwt, verifySeller, async (req, res) => { // for advertise 
  const id = req.params.id;
  const filter = { _id: ObjectId(id) }
  const options = { upsert: true };

  const updateDoc = {
    $set: {
      advertise: true
    },
  };

  const result = await productsCollection.updateOne(filter, updateDoc, options)
  res.send(result)
});

app.delete('/product/:id', verifyJwt, verifySeller, async (req, res) => {
  const id = req.params.id;
  const query = { _id: ObjectId(id) };
  const result = await productsCollection.deleteOne(query);
  res.send(result);
});

app.put('/productReport/:id', verifyJwt, async (req, res) => {
  const id = req.params.id;
  const query = { _id: ObjectId(id) };
  const options = { upsert: true };
  const updateDoc = {
    $set: {
      report: true
    },
  };
  const result = await productsCollection.updateOne(query, updateDoc, options);
  res.send(result);
});

app.get('/reportedProduct', verifyJwt, verifyAdmin, async (req, res) => {
  const query = { report: true };
  const result = await productsCollection.find(query).toArray();
  res.send(result);
});


app.delete('/reportProduct/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: ObjectId(id) }
  const result = await productsCollection.deleteOne(query);
  res.send(result);
});

// -------------> advertise
app.get('/advertisement', async (req, res) => {
  const query = { advertise: true, available: true }
  const result = await productsCollection.find(query).toArray();
  res.send(result);
});

app.get('/myBuyers', verifyJwt, verifySeller, async (req, res) => {
  const email = req.query.email;
  const query = { sellerEmail: email };
  const result = await ordersCollection.find(query).toArray();
  res.send(result)
});


// -------> orders
app.post('/order', async (req, res) => {
  const order = req.body;
  const result = await ordersCollection.insertOne(order);
  res.send(result);
});

app.get('/orders', verifyJwt, async (req, res) => {
  const email = req.query.email;
  const query = { email };
  const result = await ordersCollection.find(query).toArray();
  res.send(result);
});

app.put('/available/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: ObjectId(id) };
  const options = { upsert: true };
  const updateDoc = {
    $set: {
      available: false
    }
  }
  const result = await productsCollection.updateOne(filter, updateDoc, options);
  res.send(result);
});


// ------> payment
app.get('/order/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: ObjectId(id) }
  const result = await ordersCollection.findOne(query);
  res.send(result);
});


app.post('/create-payment-intent', async (req, res) => {
  const order = req.body;
  const price = order.price;
  const amount = price * 100;

  const paymentIntent = await stripe.paymentIntents.create({
    currency: 'usd',
    amount: amount,
    "payment_method_types": [
      "card"
    ]
  });
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});


app.post('/payments', async (req, res) => {
  const payment = req.body;
  const result = await paymentsCollection.insertOne(payment);
  res.send(result);
});


app.put('/orderPaid/:id', verifyJwt, async (req, res) => {
  const id = req.params.id;
  const filter = { _id: ObjectId(id) };
  const options = { upsert: true };
  const updateDoc = {
    $set: {
      paid: true
    }
  }
  const result = await ordersCollection.updateOne(filter, updateDoc, options);
  res.send(result);
});

app.put('/productSold/:id', verifyJwt, async (req, res) => {
  const id = req.params.id;
  const filter = { _id: ObjectId(id) };
  const options = { upsert: true };
  const updateDoc = {
    $set: {
      available: false
    }
  }
  const result = await productsCollection.updateOne(filter, updateDoc, options);
  res.send(result);
});



// ---------------------> for admin
app.get('/allBuyers', verifyJwt, verifyAdmin, async (req, res) => {
  const query = { role: 'Buyer' };
  const email = req.params.email;
  const result = await usersCollection.find(query).toArray();
  res.send(result)
});

app.delete('/buyer/:id', verifyJwt, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: ObjectId(id) };
  const result = await usersCollection.deleteOne(query);
  res.send(result);
});


app.get('/allSellers', verifyJwt, verifyAdmin, async (req, res) => {
  const query = { role: "Seller" };
  const result = await usersCollection.find(query).toArray();
  res.send(result);
});

app.delete('/seller/:id', verifyJwt, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: ObjectId(id) };
  const result = await usersCollection.deleteOne(query);
  res.send(result);
});

app.put('/verifySeller/:email', async (req, res) => {
  const email = req.params.email;
  const filter = { sellerEmail: email };
  const query = { email }
  const options = { upsert: true };
  const updateDoc = {
    $set: {
      verify: true
    }
  }
  const result = await productsCollection.updateMany(filter, updateDoc, options);
  const users = await usersCollection.updateOne(query, updateDoc, options);
  res.send(result);
});

app.get('/addPrice', verifyJwt, verifyAdmin, async (req, res) => {
  const filter = {};
  const options = { upsert: true };
  const updateDoc = {
    $set: {
      verify: false
    }
  }
  const result = await productsCollection.updateMany(filter, updateDoc, options);
  res.send(result)
});


// ----> check user role <----
app.get('/user/admin/:email', async (req, res) => { // check user is admin
  const email = req.params.email;
  const query = { email }
  const user = await usersCollection.findOne(query);
  res.send({ isAdmin: user?.role === 'admin' })
});

app.get('/user/seller/:email', async (req, res) => { // check user is seller
  const email = req.params.email;
  const query = { email }
  const user = await usersCollection.findOne(query);
  res.send({ isSeller: user?.role === 'Seller' })
});

app.get('/user/buyer/:email', async (req, res) => { // check user is buyer
  const email = req.params.email;
  const query = { email }
  const user = await usersCollection.findOne(query);
  res.send({ isBuyer: user?.role === 'Buyer' })
});


// ----------------
app.get('/', (req, res) => {
  res.send('Used Product server is running')
});


app.listen(port, () => {
  console.log(`server running on the port ${port}`.cyan)
});


/**
 * user
 *  category
 * allCategory + category/id (display all products)

 * product

 * order
 * product order

 * check user role
 * admin > all buyer + all seller + reported product
 * seller > myProducts + addProduct + myBuyers
 * buyer > myOrder + wishlist
*/