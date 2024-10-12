
// Import Dependency
const express = require('express');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const cors = require('cors');

// API Key
const port = process.env.PORT || 5000;
const apiKey = process.env.API_KEY;
const apiKey1 = process.env.API_KEY1;
const apiKey2 = process.env.API_KEY2;
const uri = process.env.MONGO_URI;

// API Endpoint
const endPoint = process.env.PLANT_NAME;
const endPoint1 = process.env.IDENTIFY;
const endPoint2 = process.env.DIAGNOSIS;
const endPoint3 = process.env.PLANT_DETAILS;


// Middleware to enable CORS & Default Setting
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage Setting
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// ________________________[ All Function ]_________________
async function searchKeyword(plantName) {
    const client = new MongoClient(uri);

    try {
        // Connect to the MongoDB server
        await client.connect();

        const database = client.db('test');
        const collection = database.collection('plants');


        const query = { plantName: { $regex: plantName, $options: 'i' } };
        const results = await collection.find(query).toArray();

        if (results.length > 0) {
            return results;
        } else {
            console.log('No plants found containing the letter:', plantName);
        }
    } catch (err) {
        console.error('Error occurred while searching:', err);
    } finally {

        await client.close();
    }
}

function delay(minutes) {
    return new Promise(resolve => setTimeout(resolve, minutes * 60 * 1000));
}

async function keepAlive() {
    const speek = await axios.get(`https://findplant.onrender.com`)
    console.log(speek.data);
    await delay(14);
    keepAlive();
}

function errorHandeler(error) {
    if (error.response) {
        // The request was made, but the server responded with a status code other than 2xx
        if (error.response.status == 404) {
            return ({ Status: 'Not a Plant Image' })
        }
        else {
            return ({ Status: 'Check Image Formate only Accept [jpg, jpeg and png] only.' })
        }

    } else if (error.request) {
        // The request was made, but no response was received
        return ({ Status: 'Check Internet Conection' })
    } else {

        return ({ Status: 'Something Went Wrong' })

    }

}

async function detailsFinder(firstWord) {

    // Find Accses Token By Plant Common Name 
    const responseToken = await axios.get(`${endPoint}${firstWord}`, {
        headers: {
            'Api-Key': apiKey1,
        }
    });

    if (responseToken.data.entities[0] == null) {
        const Check = {
            data: "Not Found Maybe Not Plant Name",
            token: false
        }
        return Check;
    } else {

        // Find Plant Details By using Token
        const responseDetails = await axios.get(`https://plant.id/api/v3/kb/plants/:${responseToken.data.entities[0].access_token}${endPoint3}`, {
            headers: {
                'Api-Key': apiKey1,
            }
        });

        const Check = {
            data: responseDetails.data,
            token: true
        }

        return Check;
    }

}

// _______________________[ All Endpoint & Api's ]__________________

app.get("/", (req, res) => {
    res.send("Api's Now Live By Ashish Tiwari");
});

app.post('/search', async (req, res) => {

    const plantDetails = await detailsFinder(req.body.name)

    if (plantDetails.token) {
        const plantData = {

            imgDetails: plantDetails.data.image.value,
            details: plantDetails.data,
            token: true,

        }
        res.status(200).json({ plantData });

    } else {
        const plantData = {
            token: false,
            details: plantDetails.data,

        }
        res.status(200).json({ plantData });
    }

})

app.post('/identify', upload.single('image'), async (req, res) => {
    const imageBuffer = req.file.buffer;

    if (!imageBuffer) {
        return res.status(400).json({ error: 'Image is required' });
    }

    try {
        let form = new FormData();
        form.append('organs', 'auto');
        form.append('images', imageBuffer, { filename: 'uploaded_image.jpg' });

        const headers = {
            ...form.getHeaders(),
            'Content-Type': `multipart/form-data; boundary=${form._boundary}`,
        };

        const { status, data } = await axios.post(endPoint1 + apiKey,
            form,
            { headers }
        );

        const results = data.results.slice(0, 1).map(result => ({
            scientificName: result.species.scientificName,
            score: result.score,
            commonNames: result.species.commonNames,
            imageUrls: result.images.map(image => image.url.s),
        }));

        let string = results[0].scientificName;
        let firstWord = string.split(/\s+/)[0];

        const plantDetails = await detailsFinder(firstWord);


        if (plantDetails.token) {

            const plantData = {
                imgDetails: results,
                details: plantDetails.data,
                token: true,
            }
            res.status(status).json({ plantData });

        } else {

            const plantData = {
                token: false,
                details: plantDetails.data,
            }
            res.status(status).json({ plantData });

        }

    } catch (error) {

        const errorType = errorHandeler(error);
        res.send(errorType);
    }
});

app.post('/diagnosis', upload.single('image'), async (req, res) => {
    const imageBuffer = req.file.buffer;
    if (!imageBuffer) {
        return res.status(400).json({ error: 'Image is required' });
    }
    const base64data = imageBuffer.toString('base64');
    axios({
        method: "POST",
        url: endPoint2,
        params: {
            api_key: apiKey2
        },

        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data: base64data
    })
        .then(function (response) {
            console.log(response.data);
            const results = {
                name: response.data.predictions[0].class,
                infect: response.data.predictions[0].confidence,
                imageUrls: base64data,
            }
            res.send(results);

        })
        .catch(function (error) {
            console.log(error.message);
            res.send({ Status: 'Plant Not Infected !' })
        });

});

app.post('/schedule', async (req, res) => {
    const plantName = req.body.plantName;
    const result = await searchKeyword(plantName)
    res.send({ result });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// End Of Backend Code...
keepAlive();//Alive Server use for Free Plan in Render
