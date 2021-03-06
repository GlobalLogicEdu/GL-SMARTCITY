
const firebaseConfig = {
  apiKey: 'AIzaSyAItpmL1bmb_2nEl-JLF4Jr3TV-fTPCUa0',
  authDomain: 'smartcity-235305.firebaseapp.com',
  databaseURL: 'https://smartcity-dev.firebaseio.com/',
  projectId: 'smartcity-235305',
  storageBucket: 'smartcity-235305.appspot.com',
  messagingSenderId: '1067909827520'
};

const createHTMLMarker = ({ OverlayView = google.maps.OverlayView,  ...args }) => {
  class HTMLMarker extends OverlayView {
    constructor() {
      super();
      this.latlng = args.latlng;
      this.html = args.html;
      this.setMap(args.map);
    }
   
    createDiv() {
      this.div = document.createElement('div');
      this.div.className = args.classList;
      this.div.style.position = 'absolute';
      if (this.html) {
        this.div.innerHTML = this.html;
      }
      google.maps.event.addDomListener(this.div, 'click', event => {
        google.maps.event.trigger(this, 'click');
      });
    }
  
    appendDivToOverlay() {
      const panes = this.getPanes();
      panes.overlayImage.appendChild(this.div);
    }
  
    positionDiv() {
      const point = this.getProjection().fromLatLngToDivPixel(this.latlng);
      if (point) {
        this.div.style.left = `${point.x}px`;
        this.div.style.top = `${point.y - args.dY}px`;
      }
    }
  
    draw() {
      if (!this.div) {
        this.createDiv();
        this.appendDivToOverlay();
      }
      this.positionDiv();
    }
  
    remove() {
      if (this.div) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
    }
  
    getPosition() {
      return this.latlng;
    }
  
    getDraggable() {
      return false;
    }
  }

  return new HTMLMarker();
};

class TruckManager {
  constructor(map) {
    this.map = map;
    this.trucksGroup = {};
  }

  add(location, url, id) {
    // const latLng = new google.maps.LatLng(50.4412606,  30.4999897);
    const latLng = new google.maps.LatLng(location);
    const truck = createHTMLMarker({
      latlng: latLng,
      map: this.map,
      html: '<div class="trucMarcker" style="background-image: url(../images/fireman_truck.jpg);"></div>',
      dY: 63,
      // classList: 'truckMarkerWraper',
      classList: '',
    });
    
    truck.addListener('click', () => {
      console.log(id);
      changeIdGauge(id);
      changeCarIdGauge(id);
    });  

    this.trucksGroup[id] = truck;
  }

  update(location, url, id) {
    this.trucksGroup[id].setMap(null);
    this.add(location, url, id);
  }

  clear() {
    const trucksCurent = Object.values(this.trucksGroup);
    trucksCurent.forEach(trucks => {
      this.trucksGroup[trucks].setMap(null);
    });
    this.trucksGroup = {};
  }

}

class RoutManager {
  constructor(map) {
    this.map = map;
    this.routGroup = {};
  }

  add(routObj, id) {
    const routArr = [];
    const singleRout = Object.values(routObj);
    singleRout.forEach(sigle => {
      if(typeof sigle !== 'string'){
        routArr.push(sigle);
      }
    });
    
    const flightPath = new google.maps.Polyline({
      path: routArr,
      geodesic: true,
      strokeColor: singleRout[singleRout.length - 1],
      strokeOpacity: 1.0,
      strokeWeight: 3
    });
    flightPath.setMap(this.map);
    
    this.routGroup[id] = flightPath;
  }

  clear() {
    const routCurent = Object.values(this.routGroup);
    routCurent.forEach(trucks => {
      this.routGroup[trucks].setMap(null);
    });
    this.routGroup = {};
  }

}

class TrafficLightManager {
  constructor(map) {
    this.map = map;
    this.focused = 1;
  }

  add(location, state, title, id) {
    const latLng = new google.maps.LatLng(location);
    const tl = createHTMLMarker({
      latlng: latLng,
      map: this.map,
      html: `
        <div id=${id} class="traffic-light traffic-light-sm" state="${state}" title="${title}">
          <div class="light red"></div>
          <div class="light yellow"></div>
          <div class="light green"></div>
        </div>`,
      dY: 90,
    });
  }

  focus(id) {
    this.focused = id;
  }
}

class PointManager {
  constructor(map) {
    this.map = map;
    this.points = {};
  }

  add(location, title, id) {
    const pnt = new google.maps.Marker({
      position: location,
      map: this.map,
      title: title,
      optimized: false
    });

    this.points[id] = pnt;
  }

  clear() {
    const pnts = Object.values(this.points);
    pnts.forEach(pnt => {
      this.points[pnt] && this.points[pnt].setMap(null);
    });
    this.points = {};
  }
}

function changeTrafficLightFocused(tl) {
  if (tl) {
    const panel = document.getElementsByClassName('traffic-light-panel-container')[0];
  
    panel.innerHTML = `
      <div class="traffic-light-panel">
        <div class="traffic-light-header">
          <div class="traffic-light-name">${tl.address ? tl.address : ''}</div>
        </div>
        <div class="traffic-light-body">
          <div class="traffic-light-box">
            <div class="box-label">Latitude</div>
            <div class="tl-latitude box-text">${tl.latitude ? tl.latitude : ''}</div>
          </div>
          <div class="traffic-light-box">
            <div class="box-label">Longitude</div>
            <div class="tl-longitude box-text">${tl.longitude ? tl.longitude : ''}</div>
          </div>
        </div>                
      </div>`;

    changeTrafficLightColor('main', tl.state, false);
  }
}

function changeTrafficLightColor(id, state, withYellow) {
  const trafficLight = document.getElementById(id);
  const oldState = trafficLight ? trafficLight.getAttribute('state') : 0;

  if (oldState != state) {
    if (withYellow && oldState) {
      trafficLight.setAttribute('state', 0);
      setTimeout(() => trafficLight.setAttribute('state', state), 400);
    } else {
      trafficLight.setAttribute('state', state);
    }
  }
}

function setMapCenter(map, db) {
  db.ref('map').once('value', snap => {
    const val = snap.val();
    val.defaultZoom && map.setZoom(val.defaultZoom);
    val.defaultLatitude && val.defaultLongitude && map.setCenter({ lat: val.defaultLatitude, lng: val.defaultLongitude });
  });
}

function CenterControl(controlDiv, map, db) {
  const controlUI = document.createElement('div');
  controlUI.style.backgroundColor = 'rgb(255, 255, 255)';
  controlUI.style.boxShadow = 'rgba(0, 0, 0, 0.3) 0px 1px 4px -1px';
  controlUI.style.borderRadius = '2px';
  controlUI.style.cursor = 'pointer';
  controlUI.style.width = '40px';
  controlUI.style.height = '40px';
  controlUI.style.margin = '10px';
  controlUI.style.position = 'relative';
  controlDiv.appendChild(controlUI);

  const controlText = document.createElement('div');
  controlText.style.backgroundImage = 'url(/images/location.png)';
  controlText.style.backgroundRepeat = 'no-repeat';
  controlText.style.backgroundPosition = 'center';
  controlText.style.backgroundSize = '25px 25px';
  controlText.style.height = '40px';
  controlUI.appendChild(controlText);

  controlUI.addEventListener('click', () => setMapCenter(map, db));
}

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const carIdButton = document.getElementById('id-car-folow');
// const carResetButton = document.getElementById('id-car-unfolow');

function initMap() {
  const map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 50.435998, lng: 30.488985}, 
    zoom: 15.5
  });
  sessionStorage.clear();

  // Add center control to map

  const centerControlDiv = document.createElement('div');
  const centerControl = new CenterControl(centerControlDiv, map, db);

  centerControlDiv.index = 1;
  map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(centerControlDiv);

  const header = document.getElementsByClassName('header-label')[0];
  header.addEventListener('click', () => setMapCenter(map, db));
  
  const tlManager = new TrafficLightManager(map);
  const trucksManager = new TruckManager(map);
  const routManager = new RoutManager(map);

  // Show trafick drow
  // const trafficLayer = new google.maps.TrafficLayer();
  // trafficLayer.setMap(map);
  function folowCar(){
    if(this.className.indexOf('disabled') === -1){
      if(this.className.indexOf('unfolow') === -1){
        this.className = 'pushed';
        const targetId = this.dataset.target;
        let latitude = '';
        let longitude = '';

        db.ref('car-locations').once('value', snapshot => {
          const val = snapshot.val();
          const trucksLocation = Object.values(val);
      
          trucksLocation.forEach(truck => {
            if( targetId === truck.id){
              latitude = truck.state.latitude;
              longitude = truck.state.longitude;
            }
            sessionStorage.setItem('folowCheckId', targetId);
          });
        });
        map.setCenter(new google.maps.LatLng(latitude, longitude));
        map.setZoom(18);
        // carResetButton.className = ' ';
        setTimeout(() => {
          this.className = 'unfolow';
          this.innerHTML = 'UNFOLLOW ME';
        }, 100);
      } else {
        this.className = 'pushed';
        sessionStorage.setItem('folowCheckId', null);
        setTimeout(() => {
          this.className = ' ';
          this.innerHTML = 'FOLLOW ME';
        }, 100);
      }
    }
  }
  // function unfollowCar(){
  //   carResetButton.className = 'disabled';
  //   sessionStorage.setItem('folowCheckId', null);
  // }
  carIdButton.addEventListener('click', folowCar);
  // carResetButton.addEventListener('click', unfollowCar);

  //------------------------Map DB------------------------------------

  db.ref('map').on('value', snapshot => {
    const val = snapshot.val() || {};
    val.zoom && map.setZoom(val.zoom);
    val.centerLatitude && val.centerLongitude && map.setCenter({ lat: val.centerLatitude, lng: val.centerLongitude });
  });

  //-------------Traffic Lights DB------------------------------------

  db.ref('traffic-lights').once('value', snapshot => {
    const val = snapshot.val();
    const tls = Object.values(val);

    tls.forEach(tl => {    
      tlManager.add(
        {
          lat: tl.latitude,
          lng: tl.longitude
        },
        tl.state,
        tl.address,
        tl.id
      );
    });
  });

  db.ref('tl-focused').on('value', snapshot => {
    const tl = snapshot.val();
    tlManager.focus(tl.id);
    
    db.ref('traffic-lights').orderByChild('id').equalTo(tl.id).limitToFirst(1).once('value', snap => {
      const val = snap.val();
      const keys = Object.keys(val);
      keys.length && changeTrafficLightFocused(val[keys[0]]);
    });
  });
  
  db.ref('traffic-lights').on('child_changed', snapshot => {
    const tl = snapshot.val() || {};

    changeTrafficLightColor(tl.id, tl.state, true);

    if (tl.id === tlManager.focused) changeTrafficLightColor('main', tl.state, true); 
  });

  //-------------TRUCKS LIST------------------------------------

  db.ref('car-locations').once('value', snapshot => {
    const val = snapshot.val();
    const trucksLocation = Object.values(val);

    trucksManager.clear();

    trucksLocation.forEach(truck => {
      trucksManager.add(
        {
          lat: truck.state.latitude,
          lng: truck.state.longitude
        },
        '/images/truckMarker.png',
        truck.id
      );
    });
  });
    
  db.ref('car-locations').on('child_changed', snapshot => {
    const truck = snapshot.val();
    console.log(truck);
    
    trucksManager.update(
      {
        lat: truck.state.latitude,
        lng: truck.state.longitude,
      },
      '/images/truckMarker.png',
      truck.id
    );

    const folowCheckId = sessionStorage.getItem('folowCheckId');
    // console.log('sessionStorage', folowCheckId);
    // console.log('id', truck.id);
    if(folowCheckId === truck.id) {
      map.setCenter(new google.maps.LatLng(truck.state.latitude, truck.state.longitude));
    }
    
  });

//--------------POLINE ROUTE ---------
  db.ref('routs').once('value', snapshot => {
    const val = snapshot.val();
    const routs = Object.values(val);

    routManager.clear();

    routs.forEach((rout, i) => {
      routManager.add(
        rout,
        i
      );
    });
  });
}

//Gauge panel
google.charts.load('current', {'packages':['gauge']});
google.charts.setOnLoadCallback(drawGaugeSpeed);
google.charts.setOnLoadCallback(drawGaugeRpm);
google.charts.setOnLoadCallback(drawGaugeGear);

let gaugeOptions  = {
  speed: {
    width: 240, height: 240,
    max: 200,
    greenColor: '#ffffff',
    greenFrom: 0,
    greenTo: 120,
    redFrom: 180, redTo: 200,
    yellowFrom:120, yellowTo: 180,
    minorTicks: 10,
    majorTicks: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200]
  },
  fps: {
    width: 240, height: 120,
    max: 60,
    greenColor: '#ffffff',
    redFrom: 0, redTo: 30,
    greenFrom:30, greenTo: 60,
    minorTicks: 0,
    majorTicks: [0, 30, 60]
  },
  gear: {
    width: 240, height: 120,
    max: 6,
    greenColor: '#ffffff',
    minorTicks: 0,
    majorTicks: [0, 1, 2, 3, 4, 5, 6]
  },
  rpm: {
    width: 240, height: 240,
    max: 8,
    greenColor: '#ffffff',
    redFrom: 7, redTo: 8,
    greenFrom:0, greenTo: 7,
    minorTicks: 10,
    majorTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8]
  }
};

let gaugeSpeed;
let gaugeRpm;
let gaugeGear;
let gaugeDataSpeed, gaugeDataFps, gaugeDataGear, gaugeDataRpm;

function drawGaugeSpeed() {
  gaugeDataSpeed = new google.visualization.DataTable();
  gaugeDataSpeed.addColumn('number', 'km/h');
  gaugeDataSpeed.addRows(1);
  gaugeDataSpeed.setCell(0, 0, 0);
  gaugeSpeed = new google.visualization.Gauge(document.getElementById('speed_div'));
  gaugeSpeed.draw(gaugeDataSpeed, gaugeOptions.speed);
}

function drawGaugeRpm() {
  gaugeDataRpm = new google.visualization.DataTable();
  gaugeDataRpm.addColumn('number', 'x1000');
  gaugeDataRpm.addRows(1);
  gaugeDataRpm.setCell(0, 0, 0);
  gaugeRpm = new google.visualization.Gauge(document.getElementById('rpm_div'));
  gaugeRpm.draw(gaugeDataRpm, gaugeOptions.rpm);
}

function drawGaugeGear() {
  gaugeDataGear = new google.visualization.DataTable();
  gaugeDataGear.addColumn('number', 'GEAR');
  gaugeDataGear.addRows(1);
  gaugeDataGear.setCell(0, 0, 0);
  gaugeGear = new google.visualization.Gauge(document.getElementById('fps_div'));
  gaugeGear.draw(gaugeDataGear, gaugeOptions.gear);
}

function changeCarIdGauge(carIdValue) {
  const carIdPanel = document.getElementById('id-car-place');
  carIdPanel.innerHTML = `${carIdValue}`;
  carIdButton.dataset.target = carIdValue;
  carIdButton.className = '';
  carIdButton.innerHTML = 'FOLLOW ME';
  sessionStorage.setItem('folowCheckId', null);
}

function changeIdGauge(carID){
  db.ref('car-locations/' + carID).on('value', snapshot => {
    const carLocations = snapshot.val();
    if (carLocations.state.speed) {
      gaugeDataSpeed.setValue(0, 0,  Math.ceil(carLocations.state.speed));
      gaugeSpeed.draw(gaugeDataSpeed, gaugeOptions.speed);
    } else {
      drawGaugeSpeed();
    }
    if (carLocations.state.rpm) {
      gaugeDataRpm.setValue(0, 0,  carLocations.state.rpm/1000);
      gaugeRpm.draw(gaugeDataRpm, gaugeOptions.rpm);
    } else {
      drawGaugeRpm();
    }
    if (carLocations.state.gear) {
      gaugeDataGear.setValue(0, 0,  carLocations.state.gear);
      gaugeGear.draw(gaugeDataGear, gaugeOptions.gear);
    } else {
      drawGaugeGear();
    }
  });
}

// Create route

function calculateAndDisplayRoute(start, end, directionsService, directionsDisplay) {
  console.log(start, end);
  directionsService.route({
    origin: start,
    destination: end,
    travelMode: 'DRIVING'
  }, function(response, status) {
    if (status === 'OK') {
      directionsDisplay.setDirections(response);
    } else {
      window.alert('Directions request failed due to ' + status);
    }
  });
}

