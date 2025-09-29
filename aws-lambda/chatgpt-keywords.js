const https = require('https');

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { title, year } = JSON.parse(event.body);

        if (!title) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Title is required' })
            };
        }

        const requestData = JSON.stringify({
            model: 'gpt-4o',
            messages: [
                {
                    role: "user",
                    content: `Please give me a list of keywords for the movie ${title} from ${year || ''} as a JSON array.
                    Please try to include keywords for the location or locations where the movie takes place.
                    Make sure the array is under the key "keywords".`
                }
            ],
            response_format: { type: "json_object" }
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        body: data
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(requestData);
            req.end();
        });

        if (response.statusCode === 200) {
            const openAIResponse = JSON.parse(response.body);
            const parsedContent = JSON.parse(openAIResponse.choices[0].message.content);

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    keywords: parsedContent.keywords?.map(keyword => keyword.toLowerCase()) || []
                })
            };
        } else {
            throw new Error(`OpenAI API returned ${response.statusCode}`);
        }

    } catch (error) {
        console.error('OpenAI API Error:', error);

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Failed to fetch keywords',
                keywords: []
            })
        };
    }
};