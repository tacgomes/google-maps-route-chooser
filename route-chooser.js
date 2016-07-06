var dirDsply = null;

function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}

function formSubmit() {
    var directions = dirDsply.getDirections();
    // As `provideRouteAlternatives` was set to `false` and there were
    // no waypoints provided in the route request message, there will be
    // a single route containing a single leg.
    assert(directions.routes.length == 1, "More than one route");
    assert(directions.routes[0].legs.length == 1, "More than one leg");
    var leg = directions.routes[0].legs[0];
    var data = {}
    data.start = {
        'lat': leg.start_location.lat(),
        'lng': leg.start_location.lng()
    };
    data.end = {
        'lat': leg.end_location.lat(),
        'lng': leg.end_location.lng()
    };
    data.waypoints = [];
    leg.via_waypoints.forEach(function(wp) {
        data.waypoints.push([wp.lat(), wp.lng()]);
    });
    var route_str = JSON.stringify(data);
    alert("Request message = " + route_str);
}

function displayRoute(dirSrvc, startMarker, destMarker) {
    var request = {
      origin: startMarker.position,
      destination: destMarker.position,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false
    };
    dirSrvc.route(request, function(result, status) {
      if (status == google.maps.DirectionsStatus.OK) {
          startMarker.setMap(null);
          destMarker.setMap(null);
          route = result.routes[0];
          startLeg = route.legs[0];
          end_leg = route.legs[route.legs.length - 1];
          // The markers from the DirectionsService are placed
          // on streets.  Update the markers position to avoid
          // jumps when the route ceases to be shown.
          startMarker.setPosition(startLeg.start_location);
          destMarker.setPosition(end_leg.end_location);
          dirDsply.setDirections(result);
          document.getElementById('submit-button').disabled = false;
          document.getElementById('status-label').innerHTML = "";
      } else if (status == google.maps.DirectionsStatus.ZERO_RESULTS) {
          document.getElementById('submit-button').disabled = true;
          document.getElementById('status-label').innerHTML =
              "Failed to find route";
      } else {
          alert("Failed to get directions:" + status);
      }
    });
}

function updateInputBox(geocoder, location, inputBox) {
    geocoder.geocode({'location': location}, function(results, status) {
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

function initialize() {
    document.getElementById('submit-button').disabled = true;
    var startInput = document.getElementById('pac-src');
    var destInput = document.getElementById('pac-dst');
    startInput.value = "";
    destInput.value = "";
    updatePlaceHolders();

    var mapOptions = {
        zoom: 12,
        center: new google.maps.LatLng(41.1579,-8.6291),
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
        if (dirDsply.getDirections() != null) {
            route = dirDsply.getDirections().routes[0];
            startLeg = route.legs[0];
            endLeg = route.legs[route.legs.length - 1];
            startInput.value = startLeg.start_address;
            destInput.value = endLeg.end_address;
        }
    });

    // Create markers for showing when not route is either
    // not being displayed or was found
    var startMarker = new google.maps.Marker({
        draggable: true,
        icon: 'spotlight-waypoint-a.png'
    });
    startMarker.addListener('dragend',function(event) {
        updateInputBox(geocoder, event.latLng, startInput);
        displayRoute(dirSrvc, startMarker, destMarker);
    });
    var destMarker = new google.maps.Marker({
        draggable: true,
        icon: 'spotlight-waypoint-b.png'
    });
    destMarker.addListener('dragend',function(event) {
        updateInputBox(geocoder, event.latLng, destInput);
        displayRoute(dirSrvc, startMarker, destMarker);
    });

    var startSet = false;
    var destSet = false;

    google.maps.event.addListener(map, 'click', function(event) {
       if (startSet == false && startInput.value == "") {
           startSet = true;
           startMarker.setPosition(event.latLng);
           startMarker.setMap(map);
           updateInputBox(geocoder, event.latLng, startInput);
           if (destInput.value == "") {
               destInput.focus();
           }
       } else if (destSet == false && destInput.value == "") {
           destSet = true;
           destMarker.setPosition(event.latLng);
           destMarker.setMap(map);
           updateInputBox(geocoder, event.latLng, destInput);
       }
       if (startSet && destSet)
       {
           displayRoute(dirSrvc, startMarker, destMarker);
       }
    });

    startInput.addEventListener("input", function() {
        dirDsply.set('directions', null);
        startMarker.setMap(null);
        startSet = false;
        if (destSet && destMarker.getMap() == null) {
            destMarker.setMap(map);
            map.panTo(destMarker.getPosition());
        }
        updatePlaceHolders();
        document.getElementById('submit-button').disabled = true;
    });

    var startSearchBox = new google.maps.places.SearchBox(startInput);
    startSearchBox.addListener('places_changed', function() {
          var places = startSearchBox.getPlaces();
          if (places.length == 0) {
              startSet = false;
              dirDsply.set('directions', null);
          } else {
              startSet = true;
              startMarker.setMap(map);
              startMarker.setPosition(places[0].geometry.location);
              map.panTo(startMarker.getPosition());
              if (destSet == true) {
                  displayRoute(dirSrvc, startMarker, destMarker);
              }
          }
    });

    destInput.value = ""
    destInput.addEventListener("input", function() {
        dirDsply.set('directions', null);
        destMarker.setMap(null);
        destSet = false;
        if (startSet && startMarker.getMap() == null) {
           startMarker.setMap(map);
           map.panTo(startMarker.getPosition());
        }
        updatePlaceHolders();
        document.getElementById('submit-button').disabled = true;
    });

    var dstSearchBox = new google.maps.places.SearchBox(destInput);
    dstSearchBox.addListener('places_changed', function() {
          var places = dstSearchBox.getPlaces();
          if (places.length == 0) {
              destSet = false;
              dirDsply.set('directions', null);
              startMarker.setMap(map);
          } else {
              destSet = true;
              destMarker.setMap(map);
              destMarker.setPosition(places[0].geometry.location);
              if (startSet == true) {
                  displayRoute(dirSrvc, startMarker, destMarker);
              }
          }
    });
}
