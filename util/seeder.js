const axios = require('axios')
const mongoose = require('mongoose')
const db = require('./db')
const User = require('../models/User')
const Review = require('../models/Review')
const Comment = require('../models/Comment')
const Company = require('../models/Company')
const Rating = require('../models/Rating')
const { LogoScrape } = require('logo-scrape');
const MONGO_URL = process.env.MONGO_URL
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})


const getInternCompassUserId = async () => {
    console.log('Creating new InternCompass account')
    const internCompassUser = new User({
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        username: 'InternCompass',
        password: 'raondom password delete later',
        email: 'InternCompass@test.com',
        institution: 'University of Waterloo',
        firstName: 'Intern',
        lastName: 'Compass',
        role: 'XINT'
    })
    internCompassUserId = await db(MONGO_URL, () => internCompassUser.save().then(doc => doc._id))

    return internCompassUserId
}

const seed = async () => {

    console.log('Updating database with Intern Compass Reviews')

    console.log('Finding/creating InternCompass User')
    let uid = await getInternCompassUserId();

    // fetching interncompass data from github
    console.log('Fetching raw Intern Compass data...')
    const companyUrl = 'https://gist.githubusercontent.com/byan1197/daf84be4b1c83176f00ea838890bdccb/raw/c4cdaf13cc39f0f8106046b2326fb13b1e5edf54/company.json'
    const jobUrl = 'https://gist.githubusercontent.com/byan1197/daf84be4b1c83176f00ea838890bdccb/raw/c4cdaf13cc39f0f8106046b2326fb13b1e5edf54/job.json'
    const userReview = 'https://gist.githubusercontent.com/byan1197/daf84be4b1c83176f00ea838890bdccb/raw/c4cdaf13cc39f0f8106046b2326fb13b1e5edf54/user_review.json'

    let rawCompaniesJson = await axios.get(companyUrl).then(response => response.data)
    let rawJobsJson = await axios.get(jobUrl).then(response => response.data)
    let rawUserReviewJson = await axios.get(userReview).then(response => response.data)



    //preparing the interncompass data in map form
    let companiesJsonMap = {}
    let jobsJsonMap = {}

    rawCompaniesJson.forEach(c => {
        companiesJsonMap[c.id] = c
    })

    rawJobsJson.forEach(j => {
        jobsJsonMap[j.id] = j
    })

    let createdCompaniesMap = {}
    let companyObjBulk = [];
    let ratingObjBulk = [];
    let reviewObjBulk = []
    let companySaveResults = []
    let ratingSaveResults = []

    let ratingJsonToMongoMap = {}
    let companyJsonToMongoMap = {}
    let colorIndex = 0;
    let colors = ['FAA', 'FFC', 'CFF', 'CCF', 'FCC', 'CFC', '9CC', 'FFC', '999']
    let blacklist = ['http://www.amd.com']


    for (var ur of rawUserReviewJson) {

        let company = companiesJsonMap[ur.company_id]
        let job = jobsJsonMap[ur.job_id]
        let color = colors[colorIndex]
        colorIndex = colorIndex >= 9 ? 0 : colorIndex + 1
        let placeholder = 'https://dummyimage.com/300x300/' + color + '/fff.png&text=' + company.name.substring(0, 1)

        if (company !== undefined && job !== undefined) {

            let ratingMongoose = new Rating({
                _id: new mongoose.Types.ObjectId(),
                culture: ur.work_life_balance_rating,
                mentorship: ur.mentorship_rating,
                impact: ur.meaningful_work_rating,
                interview: null,
                createdAt: ur.created_at
            })

            ratingJsonToMongoMap[ur.id] = ratingMongoose

            let logoURL = company.logo_url

            if (logoURL) {
                let status = await axios.get(logoURL)
                    .then(response => response.status)
                    .catch(() => {
                        return 404
                    })

                console.log('\n' + status)
                console.log(company.website_url)

                if (status === 404 && company.website_url && !(blacklist.includes(company.website_url))) {
                    let logoObjs = await LogoScrape.getLogos(company.website_url).catch(e => null)
                    if (logoObjs) {
                        let obj = logoObjs.filter(logoObj => !logoObj.data).filter(logoObj => logoObj.type.toLowerCase().includes('image'))[0]
                        console.log(obj)
                        logoURL = obj ? obj.url : placeholder
                    }
                    else
                        logoURL = placeholder
                    console.log('new logourl', logoURL)
                }
            }
            else {
                logoURL = placeholder
            }

            let companyMongoose = new Company({
                _id: new mongoose.Types.ObjectId(),
                name: company.name,
                location: job.location,
                logo: logoURL,
            })

            companyJsonToMongoMap[company.name + job.location] = companyMongoose
        }

    }

    ratingObjBulk = Object.keys(ratingJsonToMongoMap).map(id => ratingJsonToMongoMap[id])
    companyObjBulk = Object.keys(companyJsonToMongoMap).map(id => companyJsonToMongoMap[id])

    companySaveResults = await db(MONGO_URL, () => Company.collection.insertMany(companyObjBulk, { rawResult: true }).then(docs => docs.ops)).catch(e => { console.log(e); return [] })
    ratingSaveResults = await db(MONGO_URL, () => Rating.collection.insertMany(ratingObjBulk, { rawResult: true }).then(docs => docs.ops)).catch(e => { console.log(e); return [] })



    if (!companySaveResults || !ratingSaveResults) {
        return false;
    }

    // preparing the saved results in a map
    companySaveResults.forEach(c => {
        createdCompaniesMap[c.id] = c._id
    })

    rawUserReviewJson.forEach(ur => {

        let company = companiesJsonMap[ur.company_id]
        let job = jobsJsonMap[ur.job_id]

        reviewObjBulk.push(new Review({
            _id: new mongoose.Types.ObjectId(),
            salary: job.avg_salary_in_cents,
            content: ur.description,
            rating: ratingJsonToMongoMap[ur.id]._id,
            position: job.title,
            user: uid,
            company: companyJsonToMongoMap[company.name + job.location]._id,
            upvotes: [],
            downvotes: [],
            comments: [],
            id: ur.id,
            createdAt: ur.created_at
        }))
    })

    try {
        let savedReviews = await db(MONGO_URL, () => Review.collection.insertMany(reviewObjBulk, { rawResult: true }).then(reviews => reviews.ops))

        console.log('Saving complete.')
        console.log(companySaveResults.length, ' Company objects created.')
        console.log(ratingSaveResults.length, ' Rating objects created.')
        console.log(savedReviews.length, ' Review objects created.')
        return true;

    } catch (e) {
        console.log('An error has occurred trying to save everything')
        console.log(e)
        console.log('Exiting')
        return false;
    }
}


const clear = async () => {
    return mongoose.createConnection(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true }).dropDatabase((err, results) => {
        if (err) {
            console.log('Could not clear database');
            return false;
        }
        console.log('Database cleared');
        return true;
    })
}

console.log('What would you like to do?')
console.log('1 \tDrop database')
console.log('2 \tSeed database')

readline.question('', async ans => {
    console.log('ans', ans)
    var result;

    if (ans == 1) {
        console.log("Selected clear()")
        result = await clear();
    }
    else if (ans == 2) {
        console.log("Selected seed()")
        result = await seed();
    }
    else {
        console.log('No option selected')
        result = false
    }

    result ? console.log('Successfully completed operations') : console.log('Unuccessfully completed operations')
    console.log('Exiting.')
    readline.close()
    process.exit();
})
