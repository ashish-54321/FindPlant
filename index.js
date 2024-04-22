
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const cors = require('cors');


const app = express();
const port = process.env.PORT || 5000;
const apiKey = process.env.API_KEY;

const storage = multer.memoryStorage(); // store files in memory
const upload = multer({ storage: storage });

// Middleware to enable CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.send("Api's Now Live By Ashish Tiwari");
});

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

        const { status, data } = await axios.post(
            'https://my-api.plantnet.org/v2/identify/all?include-related-images=true&no-reject=false&lang=en&type=kt&api-key=' + apiKey,
            form,
            { headers }
        );

        const results = data.results.slice(0, 1).map(result => ({
            scientificName: result.species.scientificName,
            score: result.score,
            commonNames: result.species.commonNames,
            imageUrls: result.images.map(image => image.url.s),
        }));

       console.log(results);
       //Changes from mobile 
       let string = results.scientificName;
       let firstWord = string.split(/\s+/)[0];
       console.log(firstWord); // Output: "Mangifera"


        // Find Accses Token By Plant Common Name 
        const responseToken = await axios.get(`https://plant.id/api/v3/kb/plants/name_search?q=${firstWord}`, {
            headers: {
                'Api-Key': "SV7WSUX2wF4W02LFu3k8DkimKtLy8cCXLrcFVJN4sWAseJwIN0",
            }
        });


        // Find Plant Details By using Token

        const responseDetails = await axios.get(`https://plant.id/api/v3/kb/plants/:${responseToken.data.entities[0].access_token}?details=common_names,url,description,taxonomy,rank,gbif_id,inaturalist_id,image,synonyms,edible_parts,watering,propagation_methods`, {
            headers: {
                'Api-Key': "SV7WSUX2wF4W02LFu3k8DkimKtLy8cCXLrcFVJN4sWAseJwIN0",
            }
        });
        // console.log(responseDetails.data);
        const plantData = {
            imgDetails: results,
            details: responseDetails.data,

        }
        res.status(status).json({ plantData });
    }   catch (error) {
        // res.status(500).json({ error: 'Internal Server Error' });
        if (error.response) {
            // The request was made, but the server responded with a status code other than 2xx
            if (error.response.status == 404) {
                res.send({ Status: 'Not a Plant Image' })
            }
            else {
                res.send({ Status: 'Check Image Formate only Accept [jpg, jpeg and png] only.' })
            }

        } else if (error.request) {
            // The request was made, but no response was received
            res.send({ Status: 'Check Internet Conection' })
        } else {

            res.send({ Status: 'Something Went Wrong' })

        }


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
        url: "https://detect.roboflow.com/plant-disease-detection-v2-2nclk/1",
        params: {
            api_key: "nwRpZHYTLBJLFcwfIVgn"
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




app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
