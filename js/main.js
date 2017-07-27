// declaring global variables
var map;
var largeInfoWindow;
var bounds;

// Google Map styles array
var styles = [
  {
    featureType: 'water',
    stylers: [
      { color: '#19a0d8' }
    ]
  },{
    featureType: 'administrative',
    elementType: 'labels.text.stroke',
    stylers: [
      { color: '#ffffff' },
      { weight: 6 }
    ]
  },{
    featureType: 'administrative',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#e85113' }
    ]
  },{
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [
      { color: '#efe9e4' },
      { lightness: -40 }
    ]
  },{
    featureType: 'transit.station',
    stylers: [
      { weight: 9 },
      { hue: '#e85113' }
    ]
  },{
    featureType: 'road.highway',
    elementType: 'labels.icon',
    stylers: [
      { visibility: 'off' }
    ]
  },{
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [
      { lightness: 100 }
    ]
  },{
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [
      { lightness: -100 }
    ]
  },{
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [
      { visibility: 'on' },
      { color: '#f0e4d3' }
    ]
  },{
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#efe9e4' },
      { lightness: -25 }
    ]
  }
];

/**
* @description Main init function that creates the map, infowindow, and bounds object
*   It also creates the main Knockout ViewModel
*/
function initMap() {
    // Create google map
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        styles: styles,
        center: { lat: 34.0247160,lng: -117.6772340 },
        mapTypeControl: false
    });

    largeInfoWindow = new google.maps.InfoWindow();

    bounds = new google.maps.LatLngBounds();

    // Activate main KO ViewModel
    ko.applyBindings(new ViewModel());
}

/**
* @description Represents a Knockout ViewModel
*   can change via the UI, items such as:
*   - Search filter text
*   - Current visible locations (itemlist)
* @constructor
* @param {location} curr_location - A location object
*/
var ViewModel = function() {
    var self = this;

    self.searchText = ko.observable('');
    self.allLocations = [];

    // create LocationMarker object for each location from main location list (hardcoded)
    // add each location to alllocations array
    locations.forEach(function(location) {
        self.allLocations.push( new LocationMarker(location) );
    });

    // Now that all markers are created, re-fit map
    map.fitBounds(bounds);

    // computed observable which contains an array of locations that
    // are currently visible depending on search filter, this list is
    /// what is displayed on the main UI
    self.visibleLocations = ko.computed(function() {
        var searchFilter = self.searchText().toLowerCase();

        // If searching, then check each location to see if
        // title contains any characters in search filter
        // if it matches, then show marker on map
        // if not, don't show marker on map
        // Finally return filtered location list
        if (searchFilter) {
            return ko.utils.arrayFilter(self.allLocations, function(location) {
                var str = location.title.toLowerCase();
                var result = str.includes(searchFilter);
                
                // Show hide marker from map                
                location.marker.setVisible(result);
                
                return result;
            });
        }
        else {
            // If not searching (blank), then set all locations visible in map
            // we do this just in case the list was previously filtered to re-populate list
            // with all locations
            self.allLocations.forEach(function(location) {
                location.marker.setMap(map);
                location.marker.setVisible(true);
            });

            // Return location array
            return self.allLocations;
        }
    }, self);
};

/**
* @description Represents a LocationMarker object
*   - Creates Google Marker object
*   - Adds main click listener that will call populateInfoWindow function which populates and opens infowwindow
*   - Adds other listeners
* @constructor
* @param {location} curr_location - A location object
*/
var LocationMarker = function(curr_location) {
    var self = this;
    self.title = curr_location.title;
    self.position = curr_location.location;

    // Style the markers a bit. This will be our listing marker icon.
    var defaultIcon = makeMarkerIcon('0091ff');

    // Create a "highlighted location" marker color for when the user
    // mouses over the marker.
    var highlightedIcon = makeMarkerIcon('FFFF00');

    // Create a Google marker object for this location
    self.marker = new google.maps.Marker({
        position: self.position,
        title: self.title,
        icon: defaultIcon,
        animation: google.maps.Animation.DROP
    });    

    // Extend bounds with current marker's position
    bounds.extend(self.marker.position); 
    
    // Create onclick event listener which will open an infowindow for this specific marker/location
    self.marker.addListener('click', function() {
        // Call function to populate infowindow div with marker data
        populateInfoWindow(self, largeInfoWindow);

        // Make marker bounce
        self.toggleBounce();

        // Pan to this marker
        map.panTo(self.getPosition());
    });

    // Two event listeners - one for mouseover, one for mouseout,
    // to change the colors back and forth.
    self.marker.addListener('mouseover', function() {
        this.setIcon(highlightedIcon);
    });

    self.marker.addListener('mouseout', function() {
        this.setIcon(defaultIcon);
    });

    // Function that will trigger a click event (used by item list) 
    // wich will trigger the infowindow to open
    LocationMarker.prototype.viewMarker = function() {
        var marker = this.marker;
        google.maps.event.trigger(marker, 'click');
    };

    // Function that will toggle bounce effect
    LocationMarker.prototype.toggleBounce = function() {
        var marker = this.marker;

        if (marker.getAnimation() !== null) {
            marker.setAnimation(null);
        } else {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(function() {
            marker.setAnimation(null);
            }, 1400);
        }
    }    
};


/**
* @description This function performs the Foursquare APi call
*  once it's done, it returns a string to the callback function
* @constructor
* @param {LocationMarker} mLocationMarker - A locationmarker object
* @param {string} windowContent - A string object
* @param {function} callback_func - A callback function
*/
function getFourSquareData(mLocationMarker, windowContent, callback_func) {
    // Foursquare specific variables
    var foursquareKeyData = {
        clientID: 'PQF55GO44SRZHBTYSDZBEOJI0TXQD13IYU3NT2555FTPOIUE',
        clientSecret: 'QB2PMY03SSCVPM0JRTCZ245YLLECMRLOHGWQE0UFTYJKMM0B'
    };
    var foursquare_url = 'https://foursquare.com/v/'

    this.foursquare_info = {
        street : '',
        city :'',
        phone : '',
        url : ''      
    }

    // Foursquare url query
    var reqURL = 'https://api.foursquare.com/v2/venues/search?ll=' + mLocationMarker.position.lat + ',' + mLocationMarker.position.lng + '&client_id=' + foursquareKeyData.clientID + '&client_secret=' + foursquareKeyData.clientSecret + '&v=20160118' + '&query=' + mLocationMarker.title;

    // Perform api call
    // If foursquare returned data, get result data and store
    // in variable, else return error message
    $.getJSON(reqURL).done(function(data) {
        var results = data.response.venues[0];

        self.foursquare_info.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0]: '';
        self.foursquare_info.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1]: '';
        self.foursquare_info.phone = results.contact.formattedPhone ? results.contact.formattedPhone : '';
        self.foursquare_info.url = foursquare_url + results.id;

        windowContent += '<hr><h5>Foursquare Info:</h5><p>' + self.foursquare_info.street + '<br>' + self.foursquare_info.city + '<br>' + self.foursquare_info.phone + '<br><a href="' + self.foursquare_info.url  + '" target="_blank">' + self.foursquare_info.url + '</a></p><hr><h5>Streetview:</h5>';        

        callback_func(windowContent);
    }).fail(function() {
        windowContent += '<hr><h5>Foursquare Info:</h5><div style="color:red">No Foursquare data found</div><hr><h5>Streetview:</h5>';
        callback_func(windowContent);
    });    
}

/**
* @description This function populates the infowindow content with
*  the current locationmarker's data and data from other API's
*  and finally opens the actual infowindow
* @constructor
* @param {LocationMarker} mLocationMarker - A locationmarker object
* @param {largeInfoWindow} largeInfoWindow - A largeInfoWindow object
*/
function populateInfoWindow(mLocationMarker, largeInfoWindow) {
    var self = this;

    // Check to make sure the infowindow is not already opened on this marker to
    // not open it again
    if (largeInfoWindow.marker != mLocationMarker.marker) {
        // Populate initial main window content
        var windowContent = '<div><h4>' + mLocationMarker.marker.title + '</h4>';

        // Create final callback function that will be called by the getFourSquareData function
        // This function performs the Streetview API call, sets the content of the infowindow
        // and finally opens up the infowindow
        var finalizecontent = function (windowContent) {
            // Create new streetviewservice object
            var streetViewService = new google.maps.StreetViewService();
            var radius = 50;

            // Create callback function that will do the following:
            // In case the status is OK, which means the pano was found, compute the
            // position of the streetview image, then calculate the heading, then get a
            // panorama from that and set the options
            var getStreetView = function (data, status) {            
                if (status == google.maps.StreetViewStatus.OK) {
                    var nearStreetViewLocation = data.location.latLng;
                    var heading = google.maps.geometry.spherical.computeHeading(
                        nearStreetViewLocation, mLocationMarker.marker.position);
                    
                    largeInfoWindow.setContent(windowContent + '<div id="pano"></div></div>');
                    
                    var panoramaOptions = {
                        position: nearStreetViewLocation,
                        pov: {
                            heading: heading,
                            pitch: 20
                        }
                    };
                    
                    var panorama = new google.maps.StreetViewPanorama(
                        document.getElementById('pano'), panoramaOptions);
                } else {
                    largeInfoWindow.setContent(windowContent + '<div style="color: red">No Street View Found</div></div>');
                }
            };            

            // Use streetview service to get the closest streetview image within
            // 50 meters of the markers position
            streetViewService.getPanoramaByLocation(mLocationMarker.marker.position, radius, getStreetView);

            // Open the infowindow on the map with the current marker object
            largeInfoWindow.open(map, mLocationMarker.marker);    

            // Clear marker property on close
            largeInfoWindow.addListener('closeclick', function() {
                largeInfoWindow.marker = null;
            });               
        }    

        // Call Foursquare function, this function will in turn call the finalizecontent function
        getFourSquareData (mLocationMarker, windowContent, finalizecontent);
    }
}

/**
* @description This function takes in a COLOR, and then creates a new marker
* icon of that color. The icon will be 21 px wide by 34 high, have an origin
* of 0, 0 and be anchored at 10, 34).
* @constructor
* @param {string} markerColor - A string
*/
function makeMarkerIcon(markerColor) {
    var markerImage = new google.maps.MarkerImage(
        'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
        '|40|_|%E2%80%A2',
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(21, 34));
    return markerImage;
}

/**
* @description Main Google Map Error Handler
*/
function googleMapsOnError() {
    alert('An error occurred with Google Maps!');
}