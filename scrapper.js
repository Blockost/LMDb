/**
 * Created by blockost on 03/01/17.
 */


let request = require('request');
let mysql = require("mysql");

const API_KEY_V3 = 'f1b8e21ba67985a66c2ef448f467e3c7';
const BASE_URL = 'https://api.themoviedb.org/3/movie/120621';
const LATEST_MOVIE_ID = 438012; // 29/01/17
let params;

let con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'lmdb'
});

let options = {
    method: 'GET',
    url: BASE_URL,
    qs: {
        language: 'en-US',
        api_key: API_KEY_V3
    },
    body: '{}'
};

/*
 * Main loop
 * Iterated over every ID in the database
 * From 1 to /movie/latest
 */

function sendRequest(options) {
    let current_movie_id = parseInt(getMovieIdFromUrl(options.url));
    if (current_movie_id <= LATEST_MOVIE_ID) {
        request(options, function (err, response, body) {
            let next_movie_id = current_movie_id + 1;

            if (err) console.log(err);

            // If requests get rejected because of API overflowed...
            if (response.statusCode == 429) {
                console.log('Too much requests');
                setTimeout(() => {
                    options.url = incrementUrl(options.url, next_movie_id);
                    sendRequest(options);
                }, 10000);

                // If movie not found
            } else if (response.statusCode == 404) {
                // Perhaps moved or deleted
                options.url = incrementUrl(options.url, next_movie_id);
                sendRequest(options);
            } else {
                // Pass it to the response handler
                responseHandler(body);
                options.url = incrementUrl(options.url, next_movie_id);
                sendRequest(options);
            }
        });
    }
}


function responseHandler(body) {

    let movie = JSON.parse(body);

    // If the movie is admissible, e.g has a short plot
    if (isMovieAdmissible(movie)) {
        params = [
            movie.id,
            movie.title,
            movie.overview,
            movie.vote_average,
            movie.vote_count
            // + movie.tagline for experiment purposes ?
        ];

        // Add it to the database
        con.query('INSERT INTO movies SET ' +
            'TMDbId = ?, title = ?, shortPlot = ?, rating = ?, numberOfVotes = ?',
            params,
            (err, result) => {
                // Potential common error is DUPLICATE_FOUND
                if (err) console.log(err.code + ' for ' + movie.title + ' (' + movie.id + ')');
            });
    }
}

function isMovieAdmissible(movie) {
    // English
    // not adult
    return !movie.adult /*&& movie.overview.split(' ').length >= 10*/;
}

function getMovieIdFromUrl(url) {
    let split_url = url.split('/');
    let length = split_url.length;
    return split_url[length - 1]
}

function incrementUrl(url, nextMovieId) {
    let split_url = url.split('/');
    let length = split_url.length;
    split_url[length - 1] = nextMovieId;
    return split_url.join('/');
}


sendRequest(options);