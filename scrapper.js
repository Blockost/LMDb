/**
 * Created by blockost on 03/01/17.
 */


let request = require('request');
let mysql = require("mysql");

const API_KEY_V3 = 'YOUR_API_KEY';
const BASE_URL = 'https://api.themoviedb.org/3';
let params;

let con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'lmdb'
});

/*
 * Tweak these options to get different types of movies
 * Because the API allows to crawl to page 1000 only,
 * be smart and create useful queries :D
 */

let options = {
    method: 'GET',
    url: BASE_URL + '/discover/movie',
    qs: {
        include_video: 'false',
        include_adult: 'false',
        'vote_count.lte': '100',
        sort_by: 'vote_count.desc',
        language: 'en-US',
        api_key: API_KEY_V3
    },
    body: '{}'
};

/*
 * Main loop
 * Iterates over 1000 pages of results
 * May be more than 20000 results but this is the maximum allowed by the API... :'(
 */

function sendRequest(options) {
    console.log("current page: " + options.qs.page);
    if (options.qs.page <= 1000) {
        request(options, function (err, response, body) {
            if (err) console.log(err);

            // If requests get rejected because of API overflowed...
            if (response.statusCode == 429) {
                console.log('Too much requests');
                setTimeout(() => {
                    options.qs.page++;
                    sendRequest(options);
                }, 10000);

            } else {
                // Pass it to the response handler
                responseHandler(response, body);
                options.qs.page++;
                sendRequest(options);
            }
        });
    }
}


function responseHandler(response, body) {

    if (response.statusCode == 200) {
        let jsonResponse = JSON.parse(body);
        let numberOfResults = jsonResponse.results.length;

        // For every movie retrieved...
        for (let i = 0; i < numberOfResults; i++) {

            let movie = jsonResponse.results[i];
            // If the movie is admissible, e.g has a short plot
            if (isMovieAdmissible(movie)) {
                params = [
                    movie.id,
                    movie.title,
                    movie.overview,
                    movie.vote_average,
                    movie.vote_count
                ];

                // Add it to the database
                con.query('INSERT INTO movies SET ' +
                    'TMDbId = ?, title = ?, shortPlot = ?, rating = ?, numberOfVotes = ?',
                    params,
                    (err, result) => {
                        // Potential common error is DUPLICATE_FOUND
                        if (err) console.log(err.code + ' for ' + movie.title);
                    });
            }
        }

    }
}

function isMovieAdmissible(movie) {
    return movie.overview.split(' ').length >= 10;
}


// Start at page one and increment page index afterwards...
options.qs.page = 1;
sendRequest(options);