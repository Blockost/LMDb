/**
 * Created by blockost on 03/01/17.
 */


let request = require('request');
let mysql = require("mysql");

const API_KEY_V3 = 'YOUR_API_KEY';
const BASE_URL = 'https://api.themoviedb.org/3/movie/1';
const LATEST_MOVIE_ID = 456533; // 07/05/17
let params;

let sql = mysql.createConnection({
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
        request(options, (err, response, body) => {
            let next_movie_id = current_movie_id + 1;

            if (err) console.log(err);

            // If requests get rejected because of API overflowed...
            if (response.statusCode == 429) {
                console.log('Too much requests');
                setTimeout(() => {
                    options.url = incrementUrl(options.url, next_movie_id);
                    sendRequest(options);
                }, 10000);


            } else {
                // If movie found
                if (response.statusCode !== 404)
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
            movie.tagline,
            extractGenres(movie),
            movie.vote_average,
            movie.vote_count
        ];

        // Add it to the database
        sql.query('INSERT INTO Movies SET ' +
            'TMDbId = ?, title = ?, overview = ?, tagline = ?, genres = ?, rating = ?, numberOfVotes = ?',
            params,
            (err) => {
                // Potential common error is DUPLICATE_FOUND
                if (err) console.log(err.code + ' for ' + movie.title + ' (' + movie.id + ')');
            });
    }
}

function isMovieAdmissible(movie) {
    // English, not adult, with a plot
    return !movie.adult
        && movie.original_language === 'en'
        && movie.overview
        && movie.overview.split(' ').length >= 5;
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

function extractGenres(movie) {
    let genres = movie.genres;
    return genres
        .map((genre) => genre.name)
        .join(',');
}


sendRequest(options);
