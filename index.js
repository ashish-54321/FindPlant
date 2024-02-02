require('dotenv').config();

const express = require('express');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 5000;
// const apiKey = process.env.API_KEY;
const apiKey = "2b10D0mMRCxIGV5rXGZMAHx6u";

const storage = multer.memoryStorage(); // store files in memory
const upload = multer({ storage: storage });

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
            'https://my-api.plantnet.org/v2/identify/all?include-related-images=true&no-reject=false&lang=en&type=kt&api-key='+apiKey,
            form,
            { headers }
        );

        const results = data.results.slice(0, 5).map(result => ({
            scientificName: result.species.scientificName,
            score: result.score,
            commonNames: result.species.commonNames,
            imageUrls: result.images.map(image => image.url.s),
        }));

        res.status(status).json({ results });
    } catch (error) {
        console.error('error', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
