Markers = new Meteor.Collection("markers");

function D2R(deg) {
  return deg * Math.PI / 180;
};

function R2D(rad) {
  return rad / Math.PI * 180;
};

if (Meteor.isClient) {
  UI.registerHelper('testMe', function(t) {
      // console.log(arguments);
      return 'Helper Test:'+t;
  });
  
  map_canvas = null;
  changingMarker = null;
  markersObservation = null;

  mapTemplate = null;

  Session.setDefault("show_all", true);
  Session.setDefault("show_map", true);
  Session.setDefault('EARTH_RADIUS', 300000000);
  Session.setDefault('boundedArea', {
    type:'polygon', 
    coordinates: 'uepeFd}vjVkLs`HwFq}@ds@gJxBtW_BhKK`GjMhxH'
  });
  Session.setDefault('resize', null);

  function setBoundedGeometry() {
    if(map_canvas.BoundedArea)
    {
      console.log('setBoundedGeometry: '+map_canvas.BoundedAreaType);
      switch(map_canvas.BoundedAreaType)
      {
        case 'circle':
          var c = map_canvas.BoundedArea.getCenter();
          var r = map_canvas.BoundedArea.getRadius();
          if( $('input[name=show_all]:checked').val() == "show_bound")
            Session.set("geometry", {
              type: 'circle',
              coordinates: [ D2R(c.lng()), D2R(c.lat()) ],
              radius: r / Session.get('EARTH_RADIUS')
            });

          Session.set('boundedArea', {
            type:'circle', 
            radius: r,
            coordinates: c.toString().replace(/[() ]/g,'')
          });
        break;

        case 'polygon':

          if( $('input[name=show_all]:checked').val() == "show_bound")
            Session.set("geometry", {
              type: 'polygon',
              coordinates: path2mongo(map_canvas.BoundedArea.getPath())
            });

            Session.set('boundedArea', {
              type:'polygon', 
              coordinates: google.maps.geometry.encoding.encodePath(map_canvas.BoundedArea.getPath())
            });
        break;


        default:

      }      
    }
  }

  function path2mongo(path) {
    var coords = []

    path.forEach(function(p){
      coords.push(p.mongoCoords());
    });
    // close polygon
    coords.push(coords[0]);
    // console.log(coords);
    return coords ;
  }
  //
  // setup observer on the Markers collection
  // and manage markers on the map accordingly
  //
  function observerMarkers() {
    if(!markersObservation)
    {
      markersObservation = Markers.find().observe({
        changed: function(newMarker, oldMarker) {
          var marker = map_canvas.markers[newMarker._id];
          if(marker != undefined && marker.id != changingMarker)
          {
            console.log("changed mongo id "+newMarker._id);
            for(k in newMarker)
              if(oldMarker[k] == undefined)
                console.log("added "+k+" = "+newMarker[k]);

            marker.setOptions({title: newMarker.title});

            if(oldMarker.location.coordinates != newMarker.location.coordinates)
            {
              var loc = new google.maps.LatLng( R2D(newMarker.location.coordinates[1]), R2D(newMarker.location.coordinates[0]) );
              marker.setPosition( loc );
              // map_canvas.mc.resetViewport();
            }
            marker.setAnimation(google.maps.Animation.BOUNCE);
            Meteor.setTimeout(function(){
              marker.setAnimation(null);
            }, 1500);
          }
          else changingMarker = null;
        },
        added: function(newMarker, oldMarker) {
          if(newMarker.location !== undefined)
          {
            // console.log("added "+newMarker._id);
            // console.log(newMarker.location);
            var loc = new google.maps.LatLng( R2D(newMarker.location.coordinates[1]), R2D(newMarker.location.coordinates[0]) );

            var marker = new google.maps.Marker({
                position: loc,
                draggable: true,
                raiseOnDrag: true,
                animation: google.maps.Animation.DROP,
                map: map_canvas.map,
                title: newMarker.title
            });
            marker.id = newMarker._id;

            map_canvas.mc.addMarker(marker);

            map_canvas.markers[marker.id] = marker;

            google.maps.event.addListener(marker, 'dragend', function(e) {
              changingMarker = marker.id;
              var loc = new google.maps.LatLng(e.latLng.lat(), e.latLng.lng());
              // var coords = [ D2R(loc.lng()), D2R(loc.lat()) ];
              Markers.update({_id: marker.id},{
                $set:{
                  location: {
                    type: 'Point',
                    coordinates: loc.mongoCoords()
                  }
                }
              });
              console.log('dragend updated mongo id '+marker.id);
            });

            google.maps.event.addListener(marker, 'click', function(e) {
              // console.log(marker.id);
              var content = '<h3>'+marker.id+'</h3>';
              content+='<p>Drag the marker to change the positon</p>';
              content+='<label>Title</label>';
              content+='<input id="'+marker.id+'" class="marker_title" value="'+marker.title+'">';
              content+='<p><input type="button" id="'+marker.id+'" class="marker_delete" value="Delete"></p>';
              map_canvas.infowindow.close();
              map_canvas.infowindow.setContent(content);
              map_canvas.infowindow.open(map_canvas.map, marker);
            });
          }
        },
        removed: function(oldMarker) {
          if(map_canvas.markers[oldMarker._id] != undefined)
          {
            var marker = map_canvas.markers[oldMarker._id];
            map_canvas.mc.removeMarker(marker);
            // marker.setMap(null);
            delete(map_canvas.markers[oldMarker._id]);
            // console.log('removed '+oldMarker._id);
          }
        }
      });
      // Markers.find().observeChanges({
      //     changed: function(id, fields) {
      //       console.log('document changed id : ' + id);
      //     }
      // });
    }
    else console.log('already observerMarkers');
  };

  Template.hello.helpers({
    release: function() {
      return '(Meteor '+Meteor.release+')';
    },
    message: function() {
      return Session.get('message');
    },
    showAllChecked: function () {
      var b = Session.get("show_all"); 
      console.log('hello.showAll?'+b);
      return b ? "checked" : "";
    },
    showBoundChecked: function () {
      var b = Session.get("show_all"); 
      console.log('hello.showBound?'+!b);
      return !b ? "checked" : "";
    },
    showMapChecked: function () {
      console.log('hello.showMap?');
      return Session.get("show_map") ? "checked" : "";
    },
    resize: function(){
      var date = Session.get('resize');
      var width = $(window).width();
      var height = $(window).height();
      // console.log('resize to '+width+'x'+height);
      //doSomethingCool(width, height);
      if(map_canvas != null && map_canvas.map != undefined)
        google.maps.event.trigger(map_canvas.map, "resize");
      return width+'x'+height;
    } 
  });

  Template.hello.rendered = function() {
    // console.clear();
    console.log("rendered ",this.view.name);
    // console.log(this);
    // console.log(UI.body);
  };

  Template.map.created = function() {
    console.log("created ",this.view.name);
  };

  Template.map.destroyed = function() {
    this.Markers.stop();
    for(m in this.map_canvas.markers)
    {
      this.map_canvas.markers[m].setMap(null);
    }
    this.map_canvas = null;

    console.log("destroyed ",this.view.name);
  };

  Template.map.rendered = function() {
    if (!google.maps.Polygon.prototype.getBounds)
    {
       google.maps.Polygon.prototype.getBounds = function(latLng) {
          var bounds = new google.maps.LatLngBounds();
          var path = this.getPath();
          for (var i = 0; i < path.getLength(); i++) {
             bounds.extend(path.getAt(i));
          }
          return bounds;
       }
    }
    if(!google.maps.LatLng.prototype.mongoCoords)
    {
      google.maps.LatLng.prototype.mongoCoords = function() {
        return [ D2R(this.lng()), D2R(this.lat()) ]
      }
    }

    map_canvas = document.getElementById('map');
    //
    // lets start out in San Francisco
    //
    var loc = new google.maps.LatLng(37.7749295, -122.41941550000001);

    var mapOptions = {
      zoom: 16,
      center: loc,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map_canvas.markers = {};
    map_canvas.map = new google.maps.Map(map_canvas, mapOptions);
    map_canvas.mc = new MarkerClusterer(map_canvas.map,[], {gridSize: 50, maxZoom: 15});
    map_canvas.map.dragended = true;
    // our infowindow for the markers
    map_canvas.infowindow = new google.maps.InfoWindow({
        content: "<h3 style='height:10em'>This content determins the width</h3><h1>Gagaga</h1>"
    });
    //
    // create a default area in golden gate park
    //
    //
    // initialize our drawing manager
    //
    map_canvas.drawingManager = new google.maps.drawing.DrawingManager({
      // drawingMode: google.maps.drawing.OverlayType.MARKER,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.MARKER,
          google.maps.drawing.OverlayType.CIRCLE,
          google.maps.drawing.OverlayType.POLYGON,
          // google.maps.drawing.OverlayType.POLYLINE,
          // google.maps.drawing.OverlayType.RECTANGLE
        ]
      },
      // markerOptions: {
      //   icon: 'images/beachflag.png'
      // },
      polygonOptions: {
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35,
        editable: true
      },
      circleOptions: {
        fillColor: '#ff0000',
        fillOpacity: 0.38,
        strokeColor: '#FF0000',
        strokeWeight: 2,
        strokeOpacity: 0.8,
        zIndex: 1,
        editable: true
      }
    });
    map_canvas.drawingManager.setMap(map_canvas.map);
    //
    // attach event handler for drawing manager
    //
    google.maps.event.addListener(map_canvas.drawingManager, 'overlaycomplete', function(event) {
      // handle new markers
      if (event.type == google.maps.drawing.OverlayType.MARKER)
      {
        var loc = event.overlay.getPosition();
        //
        // we should check if the location falls within the boundaries of 
        // Golden Gate Park when the checkbox is not checked
        var insert = true;

        if( $('input[name=show_all]:checked').val() == "show_bound")
          if(!google.maps.geometry.poly.containsLocation(loc, map_canvas.BoundedArea))
          {
            insert = false;
            alert("That location is not within the Boundary");
          }

        if(insert)
        {
          var c = Markers.find().count() + 1;
          //
          // inserting into the collection will trigger reactiveness
          // and curser ovberve added will fire
          //
          var id = Markers.insert({
            title: "Hello World "+c,
            location: {
              type: 'Point',
              coordinates: loc.mongoCoords()
            }
          });
          // reset drawing mode
          map_canvas.drawingManager.setDrawingMode(null);
        }
        // remove the drawing tool marker since reactivity will insert the marker
        event.overlay.setMap(null);
      }

      if (event.type == google.maps.drawing.OverlayType.POLYGON)
      {
        if(map_canvas.BoundedArea) map_canvas.BoundedArea.setMap(null);
        map_canvas.BoundedAreaType = 'polygon';
        map_canvas.BoundedArea = event.overlay;
        // reset drawing mode
        map_canvas.drawingManager.setDrawingMode(null);

        setBoundedGeometry();
      }

      if (event.type == google.maps.drawing.OverlayType.CIRCLE)
      {
        if(map_canvas.BoundedArea) map_canvas.BoundedArea.setMap(null);
        map_canvas.BoundedArea = event.overlay;
        map_canvas.BoundedAreaType = 'circle';
        // reset drawing mode
        map_canvas.drawingManager.setDrawingMode(null);

        setBoundedGeometry();

        google.maps.event.addListener(map_canvas.BoundedArea, 'center_changed', function(e){
          setBoundedGeometry();
        });
        google.maps.event.addListener(map_canvas.BoundedArea, 'radius_changed', function(){
          setBoundedGeometry();
        });
      }
    });
  
    this.map_canvas = map_canvas;

    console.log("rendered ",this.view.name);

    mapTemplate = this;

    google.maps.event.addListener(map_canvas.map, 'zoom_changed', function() {
      console.log('zoom_changed');
      // if( $('input[name=show_all]:checked').val() == "show_all" )
      // {
      //   this.dragended = true;
      //   Session.set('geometry', {type:'box', coordinates: [
      //     this.getBounds().getSouthWest().mongoCoords(),
      //     this.getBounds().getNorthEast().mongoCoords(),
      //   ]});
      // }
    });

    google.maps.event.addListener(map_canvas.map, 'dragstart', function() {
      console.log('dragstart');
      this.dragended = false;
    });

    google.maps.event.addListener(map_canvas.map, 'dragend', function() {
      console.log('dragended');
      if( $('input[name=show_all]:checked').val() == "show_all")
      {
        this.dragended = true;
        setBoundedGeometry();
        Session.set('geometry', {type:'box', coordinates: [
          this.getBounds().getSouthWest().mongoCoords(),
          this.getBounds().getNorthEast().mongoCoords(),
        ]});
      }
    });

    google.maps.event.addListener(map_canvas.map, 'bounds_changed', function() {
      console.log('bounds_changed');
      if(this.dragended)
      {
        if( $('input[name=show_all]:checked').val() == "show_all" )
        {
          Session.set('geometry', {type:'box', coordinates: [
            this.getBounds().getSouthWest().mongoCoords(),
            this.getBounds().getNorthEast().mongoCoords(),
          ]});
        }
      }
      // else console.log('geometry not updated');
    });
    //
    // we need to wait for the map to be ready before we can access it
    //
    google.maps.event.addListenerOnce(map_canvas.map, 'idle', function(){
      mapTemplate.Markers = Deps.autorun(function(){
        console.log("autorun");
        Meteor.subscribe("markers", Session.get('geometry'), {
          onError: function() {
            console.log('error subscribing Markers');
          },
          onReady: function() {
            console.log("markers subscribed");
            observerMarkers();
          }
        });
      });
      var b = Session.get('boundedArea');
      if(b.coordinates != undefined && typeof b.coordinates == 'string')
      {
        if(b.type == 'polygon')
        {
          map_canvas.BoundedArea = new google.maps.Polygon({
            path: google.maps.geometry.encoding.decodePath(b.coordinates),
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.35
          });
          map_canvas.BoundedAreaType = 'polygon';
        }
        else if(b.type == 'circle')
        {
          var c = b.coordinates.split(/,/);
          if(b.radius == undefined) b.radius = 100;
          map_canvas.BoundedArea = new google.maps.Circle({
            center: new google.maps.LatLng(c[0],c[1]),
            radius: b.radius,
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.35,
            editable: true
          });
          map_canvas.BoundedAreaType = 'circle';
          google.maps.event.addListener(map_canvas.BoundedArea, 'center_changed', function(){
            setBoundedGeometry();
          });
          google.maps.event.addListener(map_canvas.BoundedArea, 'radius_changed', function(){
            setBoundedGeometry();
          });
        }
        // console.log(map_canvas.BoundedArea);
        if(map_canvas.BoundedArea)
        {
          map_canvas.BoundedArea.setMap(map_canvas.map);
        }
      }
    });
  }

  Template.hello.events({
    'click input': function(event, template) {
      // event.preventDefault();
      var c = $(event.target);
      if(c)
      {  
        var s = c.attr('id');
        if(s != undefined)
        {
          var checked = c.is(':checked');
          if(s == "show_all")
          {
            if(c.val() == 'show_all')
            {
              Session.set('geometry', {type: 'box', coordinates: [
                map_canvas.map.getBounds().getSouthWest().mongoCoords(),
                map_canvas.map.getBounds().getNorthEast().mongoCoords()
              ]});
              Session.set(s, true);
            }
            else
            {
              setBoundedGeometry();
              Session.set(s, false);
            }
          }
          else
            Session.set(s, checked);
        }
        else console.log('undefined id for '+c);
      }
    }
  });
  
  Template.map.events({
    'click input.goto_myself': function(event, template) {
      event.preventDefault();
      var map = template.map_canvas.map;
      if(navigator.geolocation)
      {
        navigator.geolocation.getCurrentPosition(function(position) {
          map.setCenter( new google.maps.LatLng(position.coords.latitude,position.coords.longitude) );
        }, function() {
          // San Francisco
          Session.set('message','getCurrentPosition failed, setting San Francisco');
          // var sf = new google.maps.LatLng( 37.998867291789836, -122.20487600000001 );
        });
      }
      // Browser doesn't support Geolocation
      else
      {
        // San Francisco
        Session.set('message','Browser does not suppport Geolocation');
      }
    },
    'click input.goto_bounds' : function (event,template) {
      event.preventDefault();

      // map_canvas.map.dragended = false;
      google.maps.event.addListenerOnce( template.map_canvas.map, 'idle', function() {
        console.log('fitBounds done');
        template.map_canvas.map.panBy(1,1);
      });
      template.map_canvas.map.fitBounds( template.map_canvas.BoundedArea.getBounds() );

      if (false && typeof console !== 'undefined')
      {
        var mapTemplateL = UI.body.lookupTemplate('map');
        var map = mapTemplate.find('#map');
        var markers = map.markers;
        console.log("You pressed the button");
        for(m in markers)
        {
          console.log(m);
        }
      }
    },
    'change input.marker_title' : function (event, template) {
      event.preventDefault();
      console.log(event.target.value);
      changingMarker = event.target.id;
      Markers.update({_id: event.target.id },{$set:{title: event.target.value}});
      map_canvas.infowindow.close();
    },
    'click input.marker_delete': function (event, template) {
      event.preventDefault();
      map_canvas.infowindow.close();
      Markers.remove({_id: event.target.id });
      console.log(event.target.id);
    }
  });

  Template.tabs.helpers({
    showMap: function() {
      return Session.get("show_map");
    }
  });

  Meteor.startup(function(){
    $(window).resize(function(e) {
      Session.set("resize", new Date());
    });
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    Markers._ensureIndex('location', '2dsphere');
  });

  Meteor.publish("markers", function ( geometry ) {
    // console.log(geometry);
    var c = null;
    switch(geometry.type)
    {
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
              $centerSphere: [ c, r ]
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
                  coordinates: [ geometry.coordinates ]
                }
              }
            }
        });
    }
    return c;
  });
}
