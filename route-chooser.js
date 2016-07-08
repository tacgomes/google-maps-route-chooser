var dirDsply = null;

var routeData = null;

// Uncomment the following declaration for testing loading an existing
// route.  The backend server should fill the real data by echoing it
// inside a `script` tag.
// var routeData = {
//     start: {
//         lat: 41.16651,
//         lng: -8.67069
//     },
//     end: {
//         lat: 41.16652,
//         lng: -8.61743
//     },
//     waypoints: [
//         [41.14524, -8.61299],
//         [41.15523, -8.59528],
//         [41.15923, -8.59488]
//     ]
// };

var Point = {
    START: 0,
    DEST: 1
};

function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message;
    }
}

function saveRoute() {
    var directions = dirDsply.getDirections();
    // As `provideRouteAlternatives` was set to `false` and there were
    // no waypoints provided in the route request message, there will be
    // a single route containing a single leg.
    assert(directions.routes.length == 1, "More than one route");
    assert(directions.routes[0].legs.length == 1, "More than one leg");
    var leg = directions.routes[0].legs[0];
    var data = {}
    data.start = {
        lat: leg.start_location.lat(),
        lng: leg.start_location.lng()
    };
    data.end = {
        lat: leg.end_location.lat(),
        lng: leg.end_location.lng()
    };
    data.waypoints = [];
    leg.via_waypoints.forEach(function(wp) {
        data.waypoints.push([wp.lat(), wp.lng()]);
    });
    var route_str = JSON.stringify(data);

    alert("Request message = " + route_str);

    // The route could then be stored in a database by doing an AJAX
    // call to the backend server, passing the JSON string in the body
    // of HTTP POST message.
}


function loadRoute(dirSrvc, markers) {
    markers[Point.START].setPosition({
        lat: routeData.start.lat,
        lng: routeData.start.lng
    });
    markers[Point.DEST].setPosition({
        lat: routeData.end.lat,
        lng: routeData.end.lng
    });
    var waypoints = [];
    for (var i = 0; i < routeData.waypoints.length; i++) {
        var wp = {
            location: {
                lat: routeData.waypoints[i][0],
                lng: routeData.waypoints[i][1]
            },
            stopover: false

        };
        waypoints.push(wp);
    }
    displayRoute(dirSrvc, markers, waypoints);
}

function displayRoute(dirSrvc, markers, waypoints) {
    if (typeof waypoints == "undefined") {
        waypoints = [];
    }
    var request = {
      origin: markers[Point.START].position,
      destination: markers[Point.DEST].position,
      travelMode: google.maps.TravelMode.DRIVING,
      waypoints: waypoints,
      optimizeWaypoints: false,
      provideRouteAlternatives: false
    };
    dirSrvc.route(request, function(result, status) {
      if (status == google.maps.DirectionsStatus.OK) {
          markers[Point.START].setMap(null);
          markers[Point.DEST].setMap(null);
          route = result.routes[0];
          startLeg = route.legs[0];
          end_leg = route.legs[route.legs.length - 1];
          // The markers from the DirectionsService are placed
          // on streets.  Update the markers position to avoid
          // jumps when the route ceases to be shown.
          markers[Point.START].setPosition(startLeg.start_location);
          markers[Point.DEST].setPosition(end_leg.end_location);
          dirDsply.setDirections(result);
          document.getElementById('submit-button').disabled = false;
          document.getElementById('status-label').style.visibility = "hidden"
      } else if (status == google.maps.DirectionsStatus.ZERO_RESULTS) {
          document.getElementById('submit-button').disabled = true;
          document.getElementById('status-label').style.visibility = "visible"
      } else {
          alert("Failed to get directions:" + status);
      }
    });
}

function updateInputBox(geocoder, location, inputBox) {
    geocoder.geocode({location: location}, function(results, status) {
        if (status === google.maps.GeocoderStatus.OK) {
            inputBox.value = results[0].formatted_address;
        } else if (status === google.maps.GeocoderStatus.ZERO_RESULTS) {
            inputBox.value = location.toUrlValue();
        } else {
            alert('Geocoder failed due to: ' + status);
        }
        updatePlaceHolders();
    });
}

function updatePlaceHolders() {
    var startInput = document.getElementById('pac-src');
    var destInput = document.getElementById('pac-dst');
    if (startInput.value == "") {
        startInput.placeholder = "Choose starting point, or click on the map…";
        destInput.placeholder = "Choose destination…";
    } else {
        destInput.placeholder = "Choose destination, or click on the map…";
   }
}

function hideRoute(map, dirDsply, markers, startSet, destSet) {
    dirDsply.set('directions', null);
    if (startSet == false) {
        markers[Point.START].setMap(null);
    }
    if (destSet == false) {
        markers[Point.DEST].setMap(null);
    }
    if (startSet && markers[Point.START].getMap() == null) {
        markers[Point.START].setMap(map);
        map.panTo(markers[Point.START].getPosition());
    }
    if (destSet && markers[Point.DEST].getMap() == null) {
        markers[Point.DEST].setMap(map);
        map.panTo(markers[Point.DEST].getPosition());
    }
    updatePlaceHolders();
    document.getElementById('submit-button').disabled = true;
}

function initialize() {
    document.getElementById('submit-button').disabled = true;
    document.getElementById('status-label').style.visibility = "hidden";

    var startInput = document.getElementById('pac-src');
    var destInput = document.getElementById('pac-dst');
    startInput.value = "";
    destInput.value = "";
    updatePlaceHolders();

    var mapOptions = {
        zoom: 12,
        center: { lat: 41.156111, lng: -8.601111 }, // Oporto, Portugal
        streetViewControl: false
    };
    var mapCanvas = document.getElementById("map-canvas");
    var map = new google.maps.Map(mapCanvas, mapOptions);
    var geocoder = new google.maps.Geocoder();
    var dirSrvc = new google.maps.DirectionsService();
    dirDsply = new google.maps.DirectionsRenderer({
        map: map,
        draggable: true,
    });

    dirDsply.addListener('directions_changed', function() {
        directions = dirDsply.getDirections();
        if (directions != null) {
            leg = directions.routes[0].legs[0];
            startInput.value = leg.start_address;
            destInput.value = leg.end_address;
        }
    });

    var startSet = false;
    var destSet = false;

    // Create markers for showing when not route is either
    // not being displayed or was found
    var markers = [null, null];
    markers[Point.START] = new google.maps.Marker({
        draggable: true,
        icon: 'spotlight-waypoint-a.png'
    });
    markers[Point.START].addListener('dragend',function(event) {
        updateInputBox(geocoder, event.latLng, startInput);
        if (destSet) {
            displayRoute(dirSrvc, markers);
        }
    });
    markers[Point.DEST] = new google.maps.Marker({
        draggable: true,
        icon: 'spotlight-waypoint-b.png'
    });
    markers[Point.DEST].addListener('dragend',function(event) {
        updateInputBox(geocoder, event.latLng, destInput);
        if (startSet) {
            displayRoute(dirSrvc, markers);
        }
    });

    google.maps.event.addListener(map, 'click', function(event) {
       if (startSet == false && startInput.value == "") {
           startSet = true;
           markers[Point.START].setPosition(event.latLng);
           markers[Point.START].setMap(map);
           updateInputBox(geocoder, event.latLng, startInput);
           if (destInput.value == "") {
               destInput.focus();
           }
       } else if (destSet == false && destInput.value == "") {
           destSet = true;
           markers[Point.DEST].setPosition(event.latLng);
           markers[Point.DEST].setMap(map);
           updateInputBox(geocoder, event.latLng, destInput);
       }
       if (startSet && destSet) {
           displayRoute(dirSrvc, markers);
       }
    });

    startInput.addEventListener("input", function() {
        startSet = false;
        hideRoute(map, dirDsply, markers, startSet, destSet);
    });
    var startAutocomplete = new google.maps.places.Autocomplete(startInput);
    startAutocomplete.bindTo('bounds', map);
    startAutocomplete.addListener('place_changed', function() {
          var place = startAutocomplete.getPlace();
          if (place.geometry) {
              startSet = true;
              markers[Point.START].setMap(map);
              markers[Point.START].setPosition(place.geometry.location);
              map.panTo(markers[Point.START].getPosition());
              if (destSet == true) {
                  displayRoute(dirSrvc, markers);
              }
          }
    });

    destInput.addEventListener("input", function() {
        destSet = false;
        hideRoute(map, dirDsply, markers, startSet, destSet);
    });
    var destAutocomplete = new google.maps.places.Autocomplete(destInput);
    destAutocomplete.bindTo('bounds', map);
    destAutocomplete.addListener('place_changed', function() {
          var place = destAutocomplete.getPlace();
          if (place.geometry) {
              destSet = true;
              markers[Point.DEST].setMap(map);
              markers[Point.DEST].setPosition(place.geometry.location);
              if (startSet == true) {
                  displayRoute(dirSrvc, markers);
              }
          }
    });

    if (routeData != null) {
        loadRoute(dirSrvc, markers);
    }
}
