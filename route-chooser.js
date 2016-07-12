var dirDsply = null;

var routeData = null;

// Uncomment the following variable declaration for testing loading an
// existing route.  The backend server should fill the real data by
// echoing it inside a `script` tag.
// var routeData = {
//     start: {
//         lat: 41.16651,
//         lng: -8.67069
//     },
//     dest: {
//         lat: 41.16652,
//         lng: -8.61743
//     },
//     waypoints: [
//         [41.14524, -8.61299],
//         [41.15523, -8.59528],
//         [41.15923, -8.59488]
//     ]
// };

var Location = {
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
    data.dest = {
        lat: leg.end_location.lat(),
        lng: leg.end_location.lng()
    };
    data.waypoints = [];
    leg.via_waypoints.forEach(function(wp) {
        data.waypoints.push([wp.lat(), wp.lng()]);
    });
    var route_str = JSON.stringify(data);

    document.getElementById('map-data').value = route_str;
    document.getElementById('directions-form').submit()
}

function loadRoute(dirSrvc, markers) {
    markers[Location.START].setPosition({
        lat: routeData.start.lat,
        lng: routeData.start.lng
    });
    markers[Location.DEST].setPosition({
        lat: routeData.dest.lat,
        lng: routeData.dest.lng
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
      origin: markers[Location.START].position,
      destination: markers[Location.DEST].position,
      travelMode: google.maps.TravelMode.DRIVING,
      waypoints: waypoints,
      optimizeWaypoints: false,
      provideRouteAlternatives: false
    };
    dirSrvc.route(request, function(result, status) {
      if (status == google.maps.DirectionsStatus.OK) {
          markers[Location.START].setMap(null);
          markers[Location.DEST].setMap(null);
          route = result.routes[0];
          startLeg = route.legs[0];
          end_leg = route.legs[route.legs.length - 1];
          // The markers from the DirectionsService are placed
          // on streets.  Update the markers position to avoid
          // jumps when the route ceases to be shown.
          markers[Location.START].setPosition(startLeg.start_location);
          markers[Location.DEST].setPosition(end_leg.end_location);
          dirDsply.setDirections(result);
          document.getElementById('submit-button').disabled = false;
          document.getElementById('status-label').style.visibility = "hidden"
      } else if (status == google.maps.DirectionsStatus.ZERO_RESULTS) {
          document.getElementById('submit-button').disabled = true;
          document.getElementById('status-label').style.visibility = "visible"
      } else {
          alert("Failed to get directions: " + status);
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
            alert("Geocoder failed due to: " + status);
        }
        updatePlaceHolders();
    });
}

function updatePlaceHolders() {
    var pacStart = document.getElementById('pac-start');
    var pacDest = document.getElementById('pac-dest');
    if (pacStart.value == "") {
        pacStart.placeholder = "Choose starting point, or click on the map…";
        pacDest.placeholder = "Choose destination…";
    } else {
        pacDest.placeholder = "Choose destination, or click on the map…";
   }
}

function oppositeLocation(point) {
    return (point + 1) % 2;
}

function hideRoute(map, markers, locationSet) {
    dirDsply.set('directions', null);
    for (var point in locationSet) {
        if (locationSet[point] == false) {
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
        locationSet, point, inputBox, icon) {
    markers[point] = new google.maps.Marker({
        draggable: true,
        icon: icon
    });
    markers[point].addListener('dragend',function(event) {
        updateInputBox(geocoder, event.latLng, inputBox);
        if (locationSet[oppositeLocation(point)]) {
            displayRoute(dirSrvc, markers);
        }
    });
}

function createAutocomplete(dirSrvc, map, markers,
        locationSet, point, inputBox) {
    inputBox.addEventListener("input", function() {
        locationSet[point] = false;
        hideRoute(map, markers, locationSet);
    });
    var autocomplete = new google.maps.places.Autocomplete(inputBox);
    autocomplete.bindTo('bounds', map);
    autocomplete.addListener('place_changed', function() {
          var place = autocomplete.getPlace();
          if (place.geometry) {
              locationSet[point] = true;
              markers[point].setMap(map);
              markers[point].setPosition(place.geometry.location);
              map.panTo(markers[point].getPosition());
              if (locationSet[oppositeLocation(point)]) {
                  displayRoute(dirSrvc, markers);
              }
          }
    });
}

function initialize() {
    document.getElementById('submit-button').disabled = true;
    document.getElementById('status-label').style.visibility = "hidden";

    var pacStart = document.getElementById('pac-start');
    var pacDest = document.getElementById('pac-dest');
    pacStart.value = "";
    pacDest.value = "";
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
            pacStart.value = leg.start_address;
            pacDest.value = leg.end_address;
        }
    });

    var locationSet = [false, false];
    var markers = [null, null];

    createMarker(dirSrvc, geocoder, markers, locationSet, Location.START,
            pacStart, 'spotlight-waypoint-a.png');
    createMarker(dirSrvc, geocoder, markers, locationSet, Location.DEST,
            pacDest, 'spotlight-waypoint-b.png');

    google.maps.event.addListener(map, 'click', function(event) {
       if (locationSet[Location.START] == false && pacStart.value == "") {
           locationSet[Location.START] = true;
           markers[Location.START].setPosition(event.latLng);
           markers[Location.START].setMap(map);
           updateInputBox(geocoder, event.latLng, pacStart);
           if (pacDest.value == "") {
               pacDest.focus();
           }
       } else if (locationSet[Location.DEST] == false && pacDest.value == "") {
           locationSet[Location.DEST] = true;
           markers[Location.DEST].setPosition(event.latLng);
           markers[Location.DEST].setMap(map);
           updateInputBox(geocoder, event.latLng, pacDest);
       }
       if (locationSet[Location.START] && locationSet[Location.DEST]) {
           displayRoute(dirSrvc, markers);
       }
    });

    createAutocomplete(dirSrvc, map, markers,
            locationSet, Location.START, pacStart);
    createAutocomplete(dirSrvc, map, markers,
            locationSet, Location.DEST, pacDest);

    if (routeData != null) {
        loadRoute(dirSrvc, markers);
    }
}
