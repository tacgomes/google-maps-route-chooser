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

function oppositePoint(point) {
    return (point + 1) % 2;
}

function hideRoute(map, markers, pointsSet) {
    dirDsply.set('directions', null);
    for (var point in pointsSet) {
        if (pointsSet[point] == false) {
            markers[point].setMap(null);
        } else if (markers[point].getMap() == null) {
            markers[point].setMap(map);
            map.panTo(markers[point].getPosition());
        }
    }
    updatePlaceHolders();
    document.getElementById('submit-button').disabled = true;
}

function createMarker(dirSrvc, geocoder, markers,
        pointsSet, point, inputBox, icon) {
    markers[point] = new google.maps.Marker({
        draggable: true,
        icon: icon
    });
    markers[point].addListener('dragend',function(event) {
        updateInputBox(geocoder, event.latLng, inputBox);
        if (pointsSet[oppositePoint(point)]) {
            displayRoute(dirSrvc, markers);
        }
    });
}

function createAutocomplete(dirSrvc, map, markers,
        pointsSet, point, inputBox) {
    inputBox.addEventListener("input", function() {
        pointsSet[point] = false;
        hideRoute(map, markers, pointsSet);
    });
    var autocomplete = new google.maps.places.Autocomplete(inputBox);
    autocomplete.bindTo('bounds', map);
    autocomplete.addListener('place_changed', function() {
          var place = autocomplete.getPlace();
          if (place.geometry) {
              pointsSet[point] = true;
              markers[point].setMap(map);
              markers[point].setPosition(place.geometry.location);
              map.panTo(markers[point].getPosition());
              if (pointsSet[oppositePoint(point)]) {
                  displayRoute(dirSrvc, markers);
              }
          }
    });
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
        minZoom: 2,
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

    var pointsSet = [false, false];
    var markers = [null, null];

    // Create markers for showing when not route is either
    // not being displayed or was found
    createMarker(dirSrvc, geocoder, markers, pointsSet, Point.START,
            startInput, 'spotlight-waypoint-a.png');
    createMarker(dirSrvc, geocoder, markers, pointsSet, Point.DEST,
            destInput, 'spotlight-waypoint-b.png');

    google.maps.event.addListener(map, 'click', function(event) {
       if (pointsSet[Point.START] == false && startInput.value == "") {
           pointsSet[Point.START] = true;
           markers[Point.START].setPosition(event.latLng);
           markers[Point.START].setMap(map);
           updateInputBox(geocoder, event.latLng, startInput);
           if (destInput.value == "") {
               destInput.focus();
           }
       } else if (pointsSet[Point.DEST] == false && destInput.value == "") {
           pointsSet[Point.DEST] = true;
           markers[Point.DEST].setPosition(event.latLng);
           markers[Point.DEST].setMap(map);
           updateInputBox(geocoder, event.latLng, destInput);
       }
       if (pointsSet[Point.START] && pointsSet[Point.DEST]) {
           displayRoute(dirSrvc, markers);
       }
    });

    createAutocomplete(dirSrvc, map, markers,
            pointsSet, Point.START, startInput);
    createAutocomplete(dirSrvc, map, markers,
            pointsSet, Point.DEST, destInput);

    if (routeData != null) {
        loadRoute(dirSrvc, markers);
    }
}
