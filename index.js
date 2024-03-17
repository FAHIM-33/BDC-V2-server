const express = require('express')
const app = express()
const port = process.env.PORT || 5000
const cors = require('cors')
require('dotenv').config()
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// middlewares
app.use(express.json())
app.use(cors())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster12.tzkl8fh.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const userCollection = client.db('BDC-V2').collection('Users')
const requestCollection = client.db('BDC-V2').collection('DonationRequests')
const blogCollection = client.db('BDC-V2').collection('Blogs')


const verifyAdmin = async (req, res, next) => {
    const email = req?.tokenUserEmail
    const filter = { email: email }
    const result = await userCollection.findOne(filter)
    if (result.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' })
    }
    next()
}

async function run() {
    try {

        // user related APIs:
        // get user
        app.get('/api/v1/user', async (req, res) => {
            const email = req?.query?.email
            const filter = { email: email }
            const user = await userCollection.findOne(filter)
            res.send(user)
        })


        // add user to DB
        app.post('/api/v1/add-user', async (req, res) => {
            const user = req.body
            user.status = 'active'
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.post('/api/v1/update-user', async (req, res) => {
            const updateUser = req.body
            const filter = { email: req?.query?.email }
            // console.log(updateUser);
            const updatedDoc = {
                $set: updateUser
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        //update Role of user
        app.get('/api/v1/update-user/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const roleField = {
                $set: req.query
            }
            // console.log(roleField);
            const result = await userCollection.updateOne(filter, roleField)
            res.send(result)
        })

        app.get('/api/v1/paginated-all-users', async (req, res) => {
            const data = req.query
            const { size, currentPage } = data
            const result = await userCollection.find()
                .skip(size * currentPage)
                .limit(size * 1)
                .toArray();
            res.send(result);
        })

        app.post('/api/v1/search-donors', async (req, res) => {
            const { email, district, upazila, blood } = req.body
            const filter = {
                $and: [
                    { email: { $regex: new RegExp(email, "i") } },
                    { district: { $regex: new RegExp(district, 'i') } },
                    { upazila: { $regex: new RegExp(upazila, 'i') } },
                    { blood: { $regex: new RegExp(blood, 'i') } },
                ]
            }
            const result = await userCollection.find(filter).toArray()
            res.send(result)
        })



        //Donation request related apis:

        // Get all requests: or user specific
        app.post('/api/v1/my-donation-request', async (req, res) => {
            let filter = { email: req.query.email }
            const result = await requestCollection.find(filter)
                .sort({ postTime: -1 })
                .skip(req.body.itemPerPage * req.body.currentPage)
                .limit(req.body.itemPerPage * 1)
                .toArray()
            res.send(result)
        })

        // Documents count for Specific user:
        app.get('/api/v1/my-don-req-count', async (req, res) => {
            const filter = req?.query
            const result = await requestCollection.countDocuments(filter)
            res.send({ count: result })
        })



        // PAGINATED all request:
        app.get('/api/v1/paginated-all-req', async (req, res) => {
            const data = req.query
            const { size, currentPage } = data
            const result = await requestCollection.find()
                .skip(size * currentPage)
                .limit(size * 1)
                .toArray();
            res.send(result);
        })

        // Get all peding reqs (public)
        app.get('/api/v1/pending-donation-request', async (req, res) => {
            const filter = { requestStatus: 'pending' }
            const result = await requestCollection.find(filter).toArray()
            res.send(result)
        })

        app.get('/api/v1/request/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const result = await requestCollection.findOne(filter)
            res.send(result)
        })

        //Request a donation
        app.post('/api/v1/create-donation-request', async (req, res) => {
            let data = req.body
            const time = new Date().getTime()
            data.postTime = time
            const result = await requestCollection.insertOne(data)
            res.send(result)
        })

        app.put('/api/v1/request-update/:id', async (req, res) => {
            const id = req.params.id
            const data = req.body
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: data
            }
            const result = await requestCollection.updateOne(filter, updateDoc)
            res.send(result)
        })


        // Delete a request
        app.delete('/api/v1/delete-donation-request/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const result = await requestCollection.deleteOne(filter)
            res.send(result)
        })

        // Update req status done or cancel:
        app.put('/api/v1/status-update/:id', async (req, res) => {
            const id = req.params.id
            const field = req.body
            if (field.requestStatus === 'in progress' && Object.keys(field).length === 1) {
                console.log("executed if block");
                return res.status(401).send({ message: 'What are you doing???' })
            }
            const filter = { _id: new ObjectId(id) }
            const updateField = {
                $set: field
            }
            const result = await requestCollection.updateOne(filter, updateField)
            res.send(result)
        })

        // Get Document Counts 
        app.get('/api/v1/all-stats', async (req, res) => {
            const totalUser = await userCollection.estimatedDocumentCount()
            const totalRequest = await requestCollection.estimatedDocumentCount()
            const result = {
                totalUser,
                totalRequest,
                totalFunding: 34
            }
            res.send(result)
        })

        // get Request  count:
        app.get('/api/v1/all-req-count', async (req, res) => {
            const totalRequest = await requestCollection.estimatedDocumentCount()
            res.send({ count: totalRequest })
        })


        // // // /// // // Blogs related APIS:

        // add a new blog
        app.post('/api/v1/add-blog', async (req, res) => {
            let blog = req.body
            blog.blogStatus = 'pending'
            console.log('The blog', blog);
            const result = await blogCollection.insertOne(blog)
            res.send(result)
        })

        // get all blogs:
        app.get('/api/v1/all-blog', async (req, res) => {
            const result = await blogCollection.find().toArray()
            res.send(result)
        })

        // ID of blog
        app.get('/api/v1/a-blog/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const result = await blogCollection.findOne(filter)
            res.send(result)
        })

        // update a blog:
        app.put('/api/v1/update-blog/:id', async (req, res) => {
            const id = req.params.id
            const data = req.body
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: data
            }
            const result = await blogCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // get all PUBLISHED blogs
        app.get('/api/v1/all-published-blog', async (req, res) => {
            const filter = { blogStatus: 'published' }
            const result = await blogCollection.find(filter).toArray()
            res.send(result)
        })

        // Publish/unpublish a blog:
        app.patch('/api/v1/publish-blog/:id', verifyAdmin, async (req, res) => {
            const id = req.params.id
            const field = req.query
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: field
            }
            const result = await blogCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // SEARCH PUBLISHED BLOGS:
        app.get('/api/v1/search-blog', async (req, res) => {
            const { title } = req.query
            const filter = {
                title: { $regex: new RegExp(title, 'i') },
                blogStatus: 'published'
            }
            const result = await blogCollection.find(filter).toArray()
            res.send(result)
        })

        // Delete blog:
        app.delete('/api/v1/delete-blog/:id', verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const result = await blogCollection.deleteOne(filter)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
    }
}
run().catch(console.dir);



app.get('/', async (req, res) => {
    res.send('BDC V2 server running')
})

app.listen(port, () => {
    console.log("BDC V2 server running on port -", port);
})