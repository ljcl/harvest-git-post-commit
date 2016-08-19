#!/usr/bin/env node
'use strict'

// https://lukeclark.com.au/posts/harvest-post-commit-hook-nodejs

// Assume dependencies are installed at the project, or
// required commands have been installed globally
var request = require('request')

// make the logOutput available anywhere
var logOutput

// Your Havest info
var credentials = {
  account: 'ACCOUNT',
  username: 'EMAIL,
  password: 'PASSWORD'
}

var options = {
  url: 'https://' + credentials.account + '.harvestapp.com/daily',
  auth: {
    username: credentials.username,
    password: credentials.password
  },
  headers: {
    'Accept': 'application/json',
    'User-Agent': 'git post commit hook'
  }
}

function harvest (cb) {
  console.log('[Harvest] Looking for running timer...')
  request(options, function (error, response, body) {
    var today = JSON.parse(body)
    if (error) cb(error, {})
    if (today.day_entries.length === 0) cb(false, 'No running timer found')
    today.day_entries.forEach(function (entry) {
      // Check for running timer
      if (typeof entry.timer_started_at !== 'undefined') {
        // Create a notes variable if there isn't one
        if (typeof entry.notes === 'undefined') entry.notes = ''
        // Append our commit to the notes
        entry.notes += '\n' + logOutput
        // Modify original request to post an update to the active timer
        var postParams = Object.assign({method: 'POST'}, options)
        postParams.url += '/update/' + entry.id
        postParams.formData = entry
        request(postParams, function (err, resp, body) {
          if (err) { cb(err, {}) } else {
            cb(false, 'Added commit to running timer')
          }
        })
      }
    })
  })
}

// Allows us to launch an external shell command
var spawn = require('child_process').spawn
// Run our command and save the reference so we can kill it if something bad happens.
var child = spawn('git', [
  '--no-pager', // Print straight away, don't use a pager
  'log',
  '--oneline', // first 7 digits of commit, and message on single line
  '--no-decorate', // Don't include ref names for commits
  '-1', // Only show the latest commit
  'HEAD' // From the current branch
])

child.stdout.on('data', function (data) {
  // Save our one liner out to a global variable, strip newlines
  logOutput = data.toString()
  logOutput = logOutput.replace(/(\r\n|\n|\r)/gm, '')
})

child.on('close', function (code) {
  if (code !== 0) {
    // 0 = good, otherwise bad
    console.error('Something went wrong, code: ', code)
    process.exit(code)
  } else {
    harvest(function (err, cb) {
      if (err) console.error(err)
      console.log('[Harvest] ' + cb)
      process.exit(code)
    })
  }
})

process.on('uncaughtException', function (err) {
  console.error('Uncaught Exception: ', err.stack)
  child.kill('SIGTERM')
  process.exit(1)
})
