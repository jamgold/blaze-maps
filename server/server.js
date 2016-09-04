Meteor.startup(function() {
  // code to run on server at startup
  Markers._ensureIndex('location', '2dsphere');
});

Meteor.publish("markers", function(geometry) {
  var c = null;
  if(geometry)
  {
    switch (geometry.type) {
      case 'box':
        var q = {
          location: {
            $geoWithin: {
              $box: geometry.coordinates
            }
          }
        };
        // console.log(EJSON.stringify(q));
        c = Markers.find(q);
        break;

      case 'circle':
        var c = geometry.coordinates;
        var r = geometry.radius;
        var q = {
          location: {
            $geoWithin: {
              $centerSphere: [c, r]
            }
          }
        };
        // console.log(EJSON.stringify(q));

        c = Markers.find(q);
        break;

      default:
        c = Markers.find({
          location: {
            $geoWithin: {
              $geometry: {
                type: "Polygon",
                coordinates: [geometry.coordinates]
              }
            }
          }
        });
    }
}
  return c;
});
