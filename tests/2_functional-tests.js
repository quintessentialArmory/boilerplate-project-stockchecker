
const MongoClient = require('mongodb').MongoClient;
const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {

  suiteSetup(function(done) {
    const opts = { useNewUrlParser: true };
    MongoClient.connect(process.env.DB_URL, opts, (error, client) => {
      if (error) throw error;
      const collection = client.db().collection(process.env.COLL_NAME);
      collection.deleteMany({}, error => {
        if (error) throw error;
        done();
      });
    });
  });
    
    suite('GET /api/stock-prices => stockData object', function() {
      
      test('1 stock', function(done) {
       chai.request(server)
        .get('/api/stock-prices')
        .query({stock: 'goog'})
        .set('x-forwarded-for', '100.100.100.100,::ffff:10.10.10.10,::ffff:10.10.10.10')
        .end(function(err, res){
          assert.equal(res.status, 200, 'http status should be 200');
          const response = res.body.stockData;
          assert.equal(response.stock, 'GOOG', '"stock" should be "GOOG"');
          assert.isTrue(/^\d+\.\d+$/.test(response.price), 'incorrect "price"');
          assert.equal(response.likes, 0, '"likes" should be 0');
          done();
        });
      });
      
      test('1 stock with like', function(done) {
       chai.request(server)
        .get('/api/stock-prices')
        .query({stock: 'goog', like: "true"})
        .set('x-forwarded-for', '100.100.100.100,::ffff:10.10.10.10,::ffff:10.10.10.10')
        .end(function(err, res){
          assert.equal(res.status, 200, 'http status should be 200');
          const response = res.body.stockData;
          assert.equal(response.stock, 'GOOG', '"stock" should be "GOOG"');
          assert.isTrue(/^\d+\.\d+$/.test(response.price), 'incorrect "price"');
          assert.equal(response.likes, 1, '"likes" should be 1');
          done();
        });
      });

      test('1 stock with like again (ensure likes arent double counted)', function(done) {
       chai.request(server)
        .get('/api/stock-prices')
        .query({stock: 'goog', like: "true"})
        .set('x-forwarded-for', '100.100.100.100,::ffff:10.10.10.10,::ffff:10.10.10.10')
        .end(function(err, res){
          assert.equal(res.status, 200, 'http status should be 200');
          const response = res.body.stockData;
          assert.equal(response.stock, 'GOOG', '"stock" should be "GOOG"');
          assert.isTrue(/^\d+\.\d+$/.test(response.price), 'incorrect "price"');
          assert.equal(response.likes, 1, '"likes" should be 1');
          done();
        });
      });

      test('2 stocks', function(done) {
       chai.request(server)
        .get('/api/stock-prices')
        .query({stock: ['goog', 'amzn']})
        .set('x-forwarded-for', '100.100.100.100,::ffff:10.10.10.10,::ffff:10.10.10.10')
        .end(function(err, res){
          assert.equal(res.status, 200, 'http status should be 200');
          const response = res.body.stockData;
          assert.isArray(response, '"stockData" should be an array');
          const equity1 = response[0];
          const equity2 = response[1];
          assert.equal(equity1.stock, 'GOOG', '"stock" should be "GOOG"');
          assert.isTrue(/^\d+\.\d+$/.test(equity1.price), 'incorrect "price"');
          assert.equal(equity1.rel_likes, 1, '"rel_likes" should be 1');

          assert.equal(equity2.stock, 'AMZN', '"stock" should be "AMZN"');
          assert.isTrue(/^\d+\.\d+$/.test(equity2.price), 'incorrect "price"');
          assert.equal(equity2.rel_likes, -1, '"rel_likes" should be -1');
          done();
        });
      });
      
      test('2 stocks with like', function(done) {
       chai.request(server)
        .get('/api/stock-prices')
        .query({stock: ['goog', 'amzn'], like: "true"})
        .set('x-forwarded-for', '100.100.100.100,::ffff:10.10.10.10,::ffff:10.10.10.10')
        .end(function(err, res){
          assert.equal(res.status, 200, 'http status should be 200');
          const response = res.body.stockData;
          assert.isArray(response, '"stockData" should be an array');
          const equity1 = response[0];
          const equity2 = response[1];
          assert.equal(equity1.stock, 'GOOG', '"stock" should be "GOOG"');
          assert.isTrue(/^\d+\.\d+$/.test(equity1.price), 'incorrect "price"');
          assert.equal(equity1.rel_likes, 0, '"rel_likes" should be 0');

          assert.equal(equity2.stock, 'AMZN', '"stock" should be "AMZN"');
          assert.isTrue(/^\d+\.\d+$/.test(equity2.price), 'incorrect "price"');
          assert.equal(equity2.rel_likes, 0, '"rel_likes" should be 0');
          done();
        });
      });
      
    });

});
