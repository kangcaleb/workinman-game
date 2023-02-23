
var AWS = require("aws-sdk");
var client = new AWS.S3({
    apiVersion: '2006-03-01', region:"us-east-1"
});


const createBucket = (username, type, success, fail) => {
    var params = {
        Bucket: `${username}-${type}`
    }

    client.createBucket(params, (err, data) => {
        if (err) {
            console.log(err)
            fail()
        } else {
            console.log(data)
            success()
        }
    })
}

module.exports = {createBucket};

