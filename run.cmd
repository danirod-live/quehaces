#!/bin/bash

npm run build
export $(cat .env)
node server
