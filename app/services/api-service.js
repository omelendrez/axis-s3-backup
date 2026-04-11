const axios = require('axios')

const api = axios.create({
  baseURL: process.env.API_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
})

module.exports = { api }
