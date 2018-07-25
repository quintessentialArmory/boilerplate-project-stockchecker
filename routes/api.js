
// I can GET /api/stock-prices with form data containing a Nasdaq stock equity
// and recieve back an object stockData.
// In stockData, I can see the stock(string, the equity), price(decimal in
// string format), and likes(int).

// I can also pass along field like as true(boolean) to have my like added to
// the stock(s). Only 1 like per ip should be accepted.
// If I pass along 2 stocks, the return object will be an array with both
// stock's info but instead of likes, it will display rel_likes(the difference
// between the likes on both) on both.

'use strict';

const MongoClient = require('mongodb').MongoClient;
const request = require('request-promise-native');
const apikey = process.env.ALPHA_VANTAGE_APIKEY;

module.exports = async function (app, done) {
  const opts = { useNewUrlParser: true };
  const client = await MongoClient.connect(process.env.DB_URL, opts);
  const collection = client.db().collection(process.env.COLL_NAME);

  app.route('/api/stock-prices')
    .get(async function (req, res) {

      let stock1, stock2;
      {
        const input = req.query.stock;
        if (typeof input === 'string') {
          stock1 = input.toUpperCase();
        } else if ( typeof input[0] === 'string'
                    && typeof input[1] === 'string') {
          stock1 = input[0].toUpperCase();
          stock2 = input[1].toUpperCase();
        } else {
          res.status(400).send('bad equity symbol');
          return
        }
      }

      if (typeof stock2 === 'undefined') {
        const equity = await getEquity(req, res, stock1);
        if (!equity) return;
        res.json({stockData: equity});
        return
      }

      const equity1 = await getEquity(req, res, stock1);
      if (!equity1) return;
      const equity2 = await getEquity(req, res, stock2);
      if (!equity2) return;
      equity1.rel_likes = equity1.likes - equity2.likes;
      equity2.rel_likes = equity2.likes - equity1.likes;
      delete equity1.likes;
      delete equity2.likes;
      res.json({stockData: [equity1, equity2]});
    });

  const getEquity = async (req, res, stock) => {
    let equity;
    try {
      const pipeline = [
        { "$match": { stock } },
        { "$project": {
          stock: true,
          price: true,
          updated_on: true,
          likes: { "$size": "$liked_by" },
        }},
      ];
      equity = (await collection.aggregate(pipeline).toArray())[0];
    } catch (e) {
      res.status(500).send('error fetching from database');
      return
    }

    if (typeof equity === 'undefined') {
      const price = await getPrice(stock);
      if (price === null) {
        res.status(500).send('error getting price');
        return
      }

      let liked_by;
      if (req.query.like === 'true') {
        liked_by = [ getIP(req) ];
      } else {
        liked_by = [];
      }

      equity = { stock, price, liked_by, updated_on: Date.now() };
      try {
        await collection.insertOne(equity);
      } catch (error) {
        console.error(error);
        res.status(500).send('error inserting equity');
        return
      }
      equity.likes = equity.liked_by.length;
      delete equity.liked_by;

    } else if (Date.now() - equity.updated_on > 60000) {
      const price = await getPrice(stock);
      if (price !== null) {
        try {
          const update = {
            $set: { price },
            $addToSet: { liked_by: getIP(req) },
          };
          collection.updateOne({ stock }, update);
        } catch (error) {
          console.error(error);
          res.status(500).send('error updating price');
          return
        }
        equity.price = price;
      } else if (req.query.like === 'true') {
        const count = await addLike(req, res, stock);
        if (count === null) return;
        equity.likes += count;
      }

    } else if (req.query.like === 'true') {
      const count = await addLike(req, res, stock);
      if (count === null) return;
      equity.likes += count;
    }

    delete equity.updated_on;
    delete equity._id;
    return equity;
  }

  const addLike = async (req, res, stock) => {
    try {
      const update = {
        $addToSet: { liked_by: getIP(req) },
      };
      const result = await collection.updateOne({ stock }, update);
      if (result.modifiedCount > 0) {
        return 1;
      }
      return 0;
    } catch (error) {
      console.error(error);
      res.status(500).send('error adding like');
      return null;
    }
  }

  done();
};

const getPrice = async stock => {
  let price;
  try {
    const series = await request({
      uri: 'https://www.alphavantage.co/query',
      qs: {
        function: 'TIME_SERIES_INTRADAY',
        symbol: stock,
        interval: '1min',
        apikey,
      },
      headers: {
          'User-Agent': 'Request-Promise'
      },
      json: true,
    });
    try {
      price = series["Time Series (1min)"]
        [ series["Meta Data"]["3. Last Refreshed"] ]
        ["4. close"];
      return price;
    } catch (error) {
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

const getIP = req => {
  const ips = req.headers['x-forwarded-for'];
  return ips.slice(0, ips.search(','));
}
