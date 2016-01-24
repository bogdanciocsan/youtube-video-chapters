(function(namespace) { // Closure to protect local variable "var hash"
    if ('replaceState' in history) { // Yay, supported!
        namespace.replaceHash = function(newhash) {
            if ((''+newhash).charAt(0) !== '#') newhash = location.pathname + '#' + newhash;
            history.replaceState('', '', newhash);
        }
    } else {
        var hash = location.hash;
        namespace.replaceHash = function(newhash) {
            if (location.hash !== hash) history.back();
            location.hash = newhash;
        };
    }

})(window);


function addRemoveActiveClassFn(allItems, activeItem, removedClass, activeClass) {
   var offClass = removedClass || "active";
   var onClass = activeClass || "active";
   allItems.removeClass(offClass);
   activeItem.addClass(onClass);
}

function checkCurrentChapter(currentTime, chaptersContainer) {
    var $chapterItems = $(chaptersContainer).children(".js-chapter-item");
    $chapterItems.each(function() {
      var hashValue = this.getAttribute('data-time') + "seconds";
      if ((currentTime > $(this).data("time")) && (currentTime < $(this).next().data("time"))) {
        addRemoveActiveClassFn($chapterItems, $(this));
//        window.replaceHash(hashValue);
      }
      else if ((currentTime > $(this).data("time")) && ($(this).next().data("time") === null)) {
        addRemoveActiveClassFn($chapterItems, $(this));
//        window.replaceHash(hashValue);
      }
    });
}
// chapter controls
function playStopFn(chaptersContainer, player, playerData) {
  var playerIsPlaying; 
  var playerIsPaused;
  var playerIsNotStarted;
  var playBtnReady = $(chaptersContainer).children(".js-play-stop-btn").find(".glyphicon");
  switch (playerData) {
    case -1:
      playerIsNotStarted = true;
      break;
    case 1: 
      playerIsPlaying = true;
      break;
    case 2:
      playerIsPaused = true;
      break;
  }
  if (playerIsPlaying) {
      addRemoveActiveClassFn(playBtnReady, playBtnReady, "glyphicon-play", "glyphicon-pause");
  }
  else if (playerIsPaused)  {
      addRemoveActiveClassFn(playBtnReady, playBtnReady, "glyphicon-pause", "glyphicon-play");
  }
 
  $(chaptersContainer).on("click", ".js-play-stop-btn", function() {
    var playBtnClicked = $(this).find(".glyphicon");                       
    if (playBtnClicked.hasClass("glyphicon-play")) {
       player.playVideo(); // start video
    }
    else if (playerIsNotStarted) {
       player.playVideo(); // start video
    }
    else {
       player.pauseVideo(); // pause video
    }
  });
}

function checkCurrentChapterLinkFn(chaptersContainer) {
  var $chapterItems = $(chaptersContainer).children(".js-chapter-item");
  $chapterItems.each(function() {
    var currentChapterURL = window.location.hash.replace("seconds", "").replace("#","").trim();
    if ($(this).data("time") == currentChapterURL) {
      addRemoveActiveClassFn($chapterItems, $(this));
    }
  });
}
function changeChapterFn(chaptersContainer, player) {
  $(chaptersContainer).find(".js-chapter-item").on("click", function () {
    var $chapterItems = $(chaptersContainer).children(".js-chapter-item");
    addRemoveActiveClassFn($chapterItems, $(this));
    var currentTime = Number(this.getAttribute('data-time'));
    player.seekTo(currentTime); // change to chapter time
    var hashValue = this.getAttribute('data-time') + "seconds";
//    window.replaceHash(hashValue);
  });   
}

// Youtube Modified API 
// based on http://gdata-samples.googlecode.com/svn/trunk/ytplayer/ChapterMarkerPlayer/index.html
// BEGIN_INCLUDE(namespace)
window.ChapterMarkerPlayer = {
    // Inserts a new YouTube iframe player and chapter markers as a child of an
    // existing HTML element on a page.
    insert: function (params) {
        // END_INCLUDE(namespace)
        // We need to reserve 30px for the player's control bar when automatically sizing the player.
        var YOUTUBE_CONTROLS_HEIGHT = 30;
        // Assume a 9:16 (width:height) ratio when we need to calculate a player's height.
        var PLAYER_HEIGHT_TO_WIDTH_RATIO = 9 / 16;
        var DEFAULT_PLAYER_WIDTH = 400;
        var DEFAULT_PLAYER_HEIGHT = 300;
        // BEGIN_INCLUDE(validation1)
        // params contains the following required and optional parameter names and values:
        //   videoId: (required) The YouTube video id of the video to be embedded.
        //   chapters: (required) Mapping of times (seconds since the video's start) to chapter titles.
        //   width: (optional) The width of the embedded player. 400px is used by default.
        //   playerOptions: (optional) An object corresponding to the options that can be passed to the
        //                  YT.Player constructor. See https://developers.google.com/youtube/iframe_api_reference#Loading_a_Video_Player
        //   chaptersContainer: (required) - a css class used on the parent of the chapter elements (li)
        if (!('videoId' in params)) {
            throw 'The "videoId" parameter must be set to the YouTube video id to be embedded.';
        }
        // END_INCLUDE(validation1)
        // BEGIN_INCLUDE(time_sort)
        var times = [];
        for (var time in params.chapters) {
            if (params.chapters.hasOwnProperty(time)) {
                times.push(time);
            }
        }
        // Sort the times numerically for display purposes.
        // See https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/sort#Examples
        times.sort(function (a, b) {
            return a - b;
        });
        // END_INCLUDE(time_sort)
        var chaptersContainer = params.chaptersContainer; 
        var width = params.width || DEFAULT_PLAYER_WIDTH;
        var currentVideoContainer = document.getElementById(params.container);
        var height = (currentVideoContainer.offsetWidth / (16 / 9)) || DEFAULT_PLAYER_HEIGHT;

        if ('YT' in window && 'Player' in window.YT) {
            // If the iframe player API is already available, proceed to loading the player using the API.
            insertPlayerAndAddChapterMarkers(params);
        } else {
            // Load the API, and add a callback to the queue to load the player once the API is available.
            if (!('onYouTubePlayerAPIReady' in window)) {
                // BEGIN_INCLUDE(invoke_callbacks)
                window.onYouTubePlayerAPIReady = function () {
                    for (var i = 0; i < window.ChapterMarkerPlayer.onYouTubePlayerAPIReadyCallbacks.length; i++) {
                        window.ChapterMarkerPlayer.onYouTubePlayerAPIReadyCallbacks[i]();
                    }
                };
                // END_INCLUDE(invoke_callbacks)
                // BEGIN_INCLUDE(load_api)
                // Dynamic <script> tag insertion will effectively load the iframe Player API on demand.
                // We only want to do this once, so it's protected by the
                // !('onYouTubePlayerAPIReady' in window) check.
                var scriptTag = document.createElement('script');
                // This scheme-relative URL will use HTTPS if the host page is accessed via HTTPS,
                // and HTTP otherwise.
                scriptTag.src = 'https://www.youtube.com/player_api';
                var firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(scriptTag, firstScriptTag);    
                // END_INCLUDE(load_api)
            }
            // BEGIN_INCLUDE(queue_callbacks)
            // We need to handle the situation where multiple ChapterMarkerPlayer.insert() calls are made
            // before the YT.Player API is loaded. We do this by maintaining an array of functions, each
            // of which adds a specific player and chapters. The functions will be executed when
            // onYouTubePlayerAPIReady() is invoked by the YT.Player API.
            window.ChapterMarkerPlayer.onYouTubePlayerAPIReadyCallbacks.push(function () {
                insertPlayerAndAddChapterMarkers(params);
            });
            // END_INCLUDE(queue_callbacks)
        }

        // BEGIN_INCLUDE(load_player)
        // Calls the YT.Player constructor with the appropriate options to add the iframe player
        // instance to a parent element.
        // This is a private method that isn't exposed via the ChapterMarkerPlayer namespace.
        function initializePlayer(containerElement, params) {
            var playerContainer = document.createElement('div');
            containerElement.appendChild(playerContainer);

            // Attempt to use any custom player options that were passed in via params.playerOptions.
            // Fall back to reasonable defaults as needed.
            var playerOptions = params.playerOptions || {};
            return new YT.Player(playerContainer, {
                // Maintain a 16:9 aspect ratio for the player based on the width passed in via params.
                // Override can be done via params.playerOptions if needed
                height: playerOptions.height || height,
                width: playerOptions.width || width,
                // Unless playerVars are explicitly provided, use a reasonable default of { autohide: 1 },
                // which hides the controls when the mouse isn't over the player.
                 playerVars: playerOptions.playerVars || { autohide: 1, autoplay: 1, theme: "light", color: "white", showinfo: 0, rel: 0, controls: 1, modestbranding: 1},
                videoId: params.videoId,
                events: {
                    onReady: playerOptions.onReady || onReadySeekTime,
                    onStateChange: playerOptions.onStateChange || onStateChange,
                    onPlaybackQualityChange: playerOptions.onPlaybackQualityChange,
                    onError: playerOptions.onError
                }
            });
            
            function onStateChange(event) {
              // calculate size for chapter elements
              var $timeTracking;
              var player = event.target;
              var playerData = event.data;
              var $chaptersContainerWidth = $(chaptersContainer).width() - $(chaptersContainer).children(".js-play-stop-btn").outerWidth();
              var $chapterItems = $(chaptersContainer).children(".js-chapter-item");
              var $videoDuration = player.getDuration();
              var $widthProcent = $chaptersContainerWidth / $videoDuration;
              var $currentTotalWidth = 0;
              
              $chapterItems.each(function() {
                var $currentChapterWidth = 0;
                if ($(this).next().data("time") !== null) {
                  $currentChapterWidth = ($(this).next().data("time") - $(this).data("time")) * $widthProcent - 50;
                  $currentTotalWidth = $currentTotalWidth + $currentChapterWidth; 
                  $(this).css("width", ($currentChapterWidth / $chaptersContainerWidth) * 100 + "%");
                }
                else {
                  $currentChapterWidth = $chaptersContainerWidth - $currentTotalWidth - 50;
                  $(this).css("width", ($currentChapterWidth / $chaptersContainerWidth) * 100 + "%");
                }
                $(this).addClass("visible");
              });
              //console.log(playerData);
              playStopFn(chaptersContainer, player, playerData);
              
              if (event.data === 0) {
                if ($('.js-youtube-next-modal').find(".js-modal-next-link").attr("href") != undefined) {
                   $('.js-youtube-next-modal').modal('show');
                }
              }
              else if (event.data === 1) {
                $timeTracking = setInterval(function() {
                  var currentTime = event.target.getCurrentTime();
                  checkCurrentChapter(currentTime, chaptersContainer);
                  // play stop custom controls
                }, 0.5);
              }
              else {
                clearInterval($timeTracking); 
              }
              
              
            }
          
            function onReadySeekTime(event) {
              var playerData = -1;
              var player = event.target;
              // change playtime according to hash link
              if (window.location.hash !== "") {
                var currentTime = Number(window.location.hash.replace("seconds", "").replace("#","").trim());
                player.seekTo(currentTime);
              } 
              playStopFn(chaptersContainer, player, playerData);
            }
        }

        // END_INCLUDE(load_player) 
        // BEGIN_INCLUDE(format_timestamp)
        // Takes a number of seconds and returns a #h##m##s string.
        function formatTimestamp(timestamp) {
            var hours = Math.floor(timestamp / 3600);
            var minutes = Math.floor((timestamp - (hours * 3600)) / 60);
            var seconds = timestamp % 60;

            var formattedTimestamp = (seconds < 10 ? '0' : '') + seconds + 's';
            if (minutes > 0) {
                formattedTimestamp = (minutes < 10 ? '0' : '') + minutes + 'm' + formattedTimestamp;
            }
            if (hours > 0) {
                formattedTimestamp = hours + 'h' + formattedTimestamp;
            }

            return formattedTimestamp;
        }

        // END_INCLUDE(format_timestamp)


        // Convenience method to call both initializePlayer and addChapterMarkers.
        // This is a private method that isn't exposed via the ChapterMarkerPlayer namespace.

        function insertPlayerAndAddChapterMarkers(params) {
            // BEGIN_INCLUDE(validation2)
            var containerElement = document.getElementById(params.container);
            if (!containerElement) {
                throw 'The "container" parameter must be set to the id of a existing HTML element.';
            }
            // END_INCLUDE(validation2)
            
            var player = initializePlayer(containerElement, params);
            // added by smartpage 11.02.2015
 
            // check current chapter hash link 
            checkCurrentChapterLinkFn(chaptersContainer);
            // chapters seek function
            changeChapterFn(chaptersContainer, player);
    
        }
    },
    // BEGIN_INCLUDE(callback_array)
    // This is used to keep track of the callback functions that need to be invoked when the iframe
    // API has been loaded. It avoids a race condition that would lead to issues if multiple
    // ChapterMarkerPlayer.insert() calls are made before the API is available.
    onYouTubePlayerAPIReadyCallbacks: []
    // END_INCLUDE(callback_array)                              
};
