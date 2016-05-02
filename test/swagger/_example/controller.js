/**
 * Standard annotations
 * @type {{get: router.get}}
 */
var router = {
  get: function () {
  }
};

//Comment

/*
 * Multi line comments
 */

//Test empty
/**
 * @swagger
 */

/**
 * Foo bar
 * @param foo
 * @returns {Promise}
 * @swagger
 * PriceEstimate:
 *   properties:
 *     product_id:
 *       type: string
 *       description: Unique identifier representing a specific product for a given latitude & longitude. For example, uberX in San Francisco will have a different product_id than uberX in Los Angeles
 *     currency_code:
 *       type: string
 *       description: "[ISO 4217](http://en.wikipedia.org/wiki/ISO_4217) currency code."
 */

var getMovies = function () {
};

//@formatter:off
/**
  @swagger
 /estimates/price:
   get:
     summary: Price Estimates
     description: |
       The Price Estimates endpoint returns an estimated price range
       for each product offered at a given location. The price estimate is
       provided as a formatted string with the full price range and the localized
       currency symbol.<br><br>The response also includes low and high estimates,
       and the [ISO 4217](http://en.wikipedia.org/wiki/ISO_4217) currency code for
       situations requiring currency conversion. When surge is active for a particular
       product, its surge_multiplier will be greater than 1, but the price estimate
       already factors in this multiplier.
     parameters:
       - name: start_latitude
         in: query
         description: Latitude component of start location.
         required: true
         type: number
         format: double
       - name: start_longitude
         in: query
         description: Longitude component of start location.
         required: true
         type: number
         format: double
       - name: end_latitude
         in: query
         description: Latitude component of end location.
         required: true
         type: number
         format: double
       - name: end_longitude
         in: query
         description: Longitude component of end location.
         required: true
         type: number
         format: double
     tags:
       - Estimates
     responses:
       200:
         description: An array of price estimates by product
         schema:
           type: array
           items:
             $ref: '#/definitions/PriceEstimate'
       default:
         description: Unexpected error
         schema:
           $ref: '#/definitions/Error'
 @throws {LogicException} something wrong
 */
//@formatter:on
router.get('/', function () {
}());

//@formatter:off
/**
  @swagger
 Error:
   properties:
     code:
       type: integer
       format: int32
     message:
       type: string
     fields:
       type: string
*/
//@formatter:on
module.exports = router;

/**
 * @swagger
 * test unknown type:
 * this annotation not able to parse as yaml
 */
