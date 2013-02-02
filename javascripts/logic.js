"use strict";

new function( document, $, undefined ) {

    // Slide constructor
    var Slide = function( elem, options ) {
        var me = this,
            $elem = $( elem );

        me.$elem = $elem;
        me.id = $elem.attr('id');
        me.index = $elem.index();
        me.options = options;
        me.timer = $elem.attr( me.options.timeAttr ) || me.options.slideTimer;
        me.steps = [];
        me.currentStep = null;

        me.findSteps( $elem );
    };
    Slide.prototype = {
        findSteps: function( $elem ) {
            var me = this,
                $steps = $elem.find( '.' + me.options.stepsContainerClass );

            $.each( $steps, function( ind, stepsContainer ) {
                me.addSteps( $( stepsContainer ) )
            });

            return me;
        },
        addSteps: function( $stepsContainer ) {
            if ( $stepsContainer.data('processed') ) return;
            $stepsContainer.data('processed', true);

            var me = this, opts = me.options,
                $steps = $stepsContainer.children(),
                stepTimer = $stepsContainer.attr( opts.timeAttr ) || opts.stepTimer;

            $.each( $steps, function( ind, step ) {
                step = $( step );

                if ( step.hasClass( opts.stepsContainerClass ) ) {
                    me.addSteps( step );
                    return;
                }

                step.addClass( opts.stepClass );

                me.steps.push({
                    $elem  : step,
                    timer  : step.attr( opts.timeAttr ) || stepTimer
                });

                me.findSteps( step );
            });

            return me;
        },
        doStep: function() {
            var next = this.steps.shift();
            next.$elem.removeClass( this.options.stepClass );
            this.currentStep = next;
            return next;
        }
    };

    // Present constructor
    var Present = function( elem, options ) {
        var $elem = $( elem ),
            id = $elem.attr('id');

        // override default options
        this.options = $.extend( true, {}, this.defaults, options );

        // prepare container
        if ( !id ) {
            id = 'present' + ( $elem.index() + 1 );
            $elem.attr('id', id);
        }
        $elem.addClass('presentation');

        // define properties
        this.$elem = $elem;
        this.id = id;
        this.slides = [];
        this.slidesCount = 0;
        this.currentSlide = -1;
        this.playTimeOut = null;
        this.status = { paused: false, playing: false, stopped: true };

        // prepare slides
        this.addSlides( $elem.children('article') );

        // trigger onReady event
        this._onReady();

        return this;
    };
    Present.prototype = {
        defaults: {
            autoPlay     : false, // whether or not to automatically begin playing the slides
            bindToHistory: true,  // whether on not to modify
            controlPanel : true,  // whether or not to add a control panel
            loopPlay     : false, // whether or not to loop playing the slides
            initialScale : 85,    // percentage value to scale on init
            initialTheme : 'Dark',// choose between Dark or Light
            onReady   : $.noop,   // gets called when present is setup and ready to go
            onPlay    : $.noop,   // gets called when the play() method is called
            onStop    : $.noop,   // gets called when the stop() method is called
            onPause   : $.noop,   // gets called when the pause() method is called
            onRestart : $.noop,   // gets called when the restart() method is called
            scaleOnResize: true,  // whether or not to scale the slides on window resize
            transition   : true,  // whether or not to use slide transitions
            userEvents   : true,  // whether or not to bind user events to slides controls
            slide: {
                stepsClass: 'steps',
                slideTimer: 4500,
                stepTimer : 1500,
                slideClass: 'slide',
                stepsContainerClass: 'steps',
                stepClass : 'step',
                timeAttr  : 'data-timer'
            },
            initialSlide : 1,     //
            presentClass : 'presentation',
            slidesClasses: [ 'farPrev', 'prev', 'current', 'next', 'farNext' ],
            presentThemes: [ 'Light', 'Dark' ]
        },

        _onReady: function() {
            var me = this,
                opts = me.options;

            me.scale = this._setScaleHandler();
            me.changeTheme = this._setThemeToggler();

            // bind events
            this._bindEvents();

            // load Prettify and font
            this._addPrettify();
            this._addFontStyle();


            // create the control panel, if enabled
            opts.controlPanel && this._addControls();


            // scale to initial value
            this.scale( opts.initialScale );

            // change theme to initial
            this.changeTheme( opts.initialTheme );

            // toggle transition to initial value
            this.toggleTransition( opts.transition );


            // goTo initial slide
            var firstSlide = this.getSlideFromHash();
            this.goTo( firstSlide && firstSlide.index || opts.initialSlide - 1, true );

            // update history state, if enabled
            opts.bindToHistory && this._setState( true );

            // begin auto play, if enabled
            opts.autoPlay && this.play();


            this.defaults.onReady();
            return me;
        },
        _bindEvents: function() {
            var me = this,
                $elem = me.$elem,
                defs = me.options;

            // bind global events
            defs.scaleOnResize && setWinResizeHandler( me.scale );
            defs.bindToHistory && $( window ).on('popstate', $.proxy( me._onPopState, me ) );
            $( document ).on("fullscreenchange webkitfullscreenchange mozfullscreenchange msfullscreenchange", function ( e ) {
                var doc = this;
                me.$elem.trigger('fullScreenToggled',
                    doc.fullscreenElement ||
                        doc.mozFullScreenElement ||
                        doc.webkitFullscreenElement ||
                        doc.webkitCurrentFullScreenElement ||
                        doc.msFullScreenElement );
                me.scale();
            });
            $elem.on({
                'touchstart': touchHandler,
                'touchmove' : touchHandler,
                'touchend'  : touchHandler
            });

            // bind user events
            if ( defs.userEvents ) {
                // keys
                $( document ).on( "keydown", $.proxy( me._keysHandler, me ) );

                $elem
                    // mousemove
                    .on('mouseover mousemove', function setFocus() {
                        $(this).off( 'mouseover mousemove', setFocus )
                            .addClass( 'focused' )
                            .hover(
                            function() { $(this).addClass( 'focused' ) },
                            function() { $(this).removeClass( 'focused' ) }
                        )
                    })
                    // touch
                    .on( setTouchHandler( function( dir ) {
                    if ( dir ) dir > 0? me.next(): me.previous();
                }))
                    // scroll
                    .on( setWheelHandler( function( dir ) {
                    if ( dir ) dir > 0? me.next(): me.previous();
                }));
            }

            // bind inner links
            me.$elem.find('a[href^="#"]').on('mousedown', function( e ) {
                e.preventDefault();
                me.goTo( me.id + '_' + $(this).attr('href').substr(1) );
            });

            return me;
        },
        _addControls: function () {
            var me = this,
                $elem = me.$elem;

            function btn( cls, icon, title ) {
                return $('<button/>', {
                    class: 'control ' + cls,
                    html: '<i class="icon-'+ (icon? icon: cls) +'"></i>',
                    title: title
                });
            }

            // define controls structure
            var $backCounter = $('<div/>', { class: 'backCounter', text: 1 }),
                $footer      = $('<div/>', { class: 'footer' }),
                $space       = '<span class="space"></span>',

                $controls = $('<div/>',{ class: 'controls'}),

                $counter = $('<div/>', { class: 'control counter' }),
                $current = $('<input/>', { class: 'current', type: 'text', value: 1, maxlength:3, all: 7 }),
                $count   = $('<span/>',  { class: 'count', text: me.slidesCount }),

                $scaler = $('<div/>', { class: 'control scaler' }),
                $scale  = btn( 'scale', 'zoom-in' ),
                $scroll = $('<div/>', { class: 'control scroll', min: 40, max: 100}),

                $settings = $('<div/>', { class: 'control settings' }),
                $sets = btn( 'sets', 'cog' ),
                $menu = $('<div/>', { class: 'menu' }),
                $themeSelector = $('<div/>', { class: 'handler themeSelector' }),
                $transToggler  = $('<div/>', { class: 'handler transToggler' }),

                $prev = btn( 'prev', 'arrow-left' ),
                $next = btn( 'next', 'arrow-right' ),
                $play = btn( 'play' ),
                $full = btn( 'fullscreen' );

            // build controls
            $scaler.append( $scale, $scroll );
            $counter.append( $current, $('<span/>', { class: 'divider', text: '/' }), $count );
            $settings.append( $sets, $menu.append( $themeSelector, $transToggler ) );
            $controls.append(
                $counter, $space,
                $prev,  $next, $space,
                $play, $full, $space,
                $scaler, $settings
            );
            $footer.append( $controls );

            // append controls
            $elem.append( $backCounter, $footer );

            // create extended controls
            var themeSelector = new Select( $themeSelector, 'Theme:', me.options.presentThemes, $.proxy( me.changeTheme, me )),
                transToggler  = new Select( $transToggler, 'Transition:', ['On', 'Off'], function( mode ) {
                    me.toggleTransition( mode === 'On' );
                }),
                scaler = new Scroll( $scroll, me.scale );


            // add controls events
            $counter.hover(
                function () { $current.focus() },
                function () { $current.blur() }
            );
            $current.on({
                'keyup change': function (e) {
                    var val = $current.val();
                    if ( val === '' ) return;

                    val = val.match(/[0-9]/g);
                    val = val && val.join('') || '';
                    $current.val( val );

                    if ( val === '' ) return;

                    me.goTo( parseInt( val ) - 1 );
                },
                'blur': function() { $current.val( me.currentSlide + 1 ); }
            });

            $controls.on('mousedown', 'button', function (e) {
                var target = $(e.currentTarget);

                if ( target.hasClass('prev') )  me.previous();
                else if ( target.hasClass('next') )  me.next();
                else if ( target.hasClass('play') )  me.status.playing? me.pause(): me.play();
                else if ( target.hasClass('scale') ) me.scale( 100 );
                else if ( target.hasClass('fullscreen') ) toggleFullScreen( me.$elem[0] );
                else if ( target.hasClass('sets') ) {
                    $sets.toggleClass('active');
                    $menu.slideToggle();
                }
            });
            $('body').on('mousedown', function toggle(e) {
                if ( !$(e.target).parents('.settings')[0] && $sets.hasClass('active') ) {
                    $sets.removeClass('active');
                    $menu.slideUp();
                }
            })

            // bind controls to present's events
            var controlsActiveTimeout = setTimeout(function() { $controls.addClass('hidden') }, 2000);
            $elem.on({
                'mousedown mousemove': function() {
                    clearTimeout( controlsActiveTimeout );
                    controlsActiveTimeout = null;
                    $controls.removeClass('hidden');
                    controlsActiveTimeout = setTimeout(function() { $controls.addClass('hidden') }, 2000);
                },

                'onSlideChanged': function() {
                    var current = me.currentSlide;

                    current < 1? $prev.attr('disabled', 'disabled'): $prev.removeAttr('disabled');
                    current > me.slidesCount-2? $next.attr('disabled', 'disabled'): $next.removeAttr('disabled');

                    $current.val( current + 1 );
                    $backCounter.text( current + 1 );
                },

                'scaleChanged': function( e, val ) {
                    scaler.setValue( val );
                },
                'themeChanged': function( e, val ) {
                    themeSelector.setValue( val );
                },
                'transitionToggled': function( e, mode ) {
                    transToggler.setValue( mode? 'On': 'Off' );
                },
                'fullScreenToggled': function( e, isFull ) {
                    $full.toggleClass( 'active', isFull );
                },

                'onPlay': function() {
                    $play.toggleClass( 'active', true );
                },
                'onPause': function() {
                    $play.toggleClass( 'active', false );
                },
                'onStop': function() {
                    $play.removeClass( 'active' );
                }
            });


            me.controls = $controls;
            return $controls;

        },

        addSlides: function( $slides ) {
            var me = this,
                $slide, slideId,
                id = this.id,
                opts = this.options.slide;

            $.each( $slides, function( ind, slide ) {
                $slide = $( slide );
                slideId = $slide.attr( 'id' ) || 'slide' + ( $slide.index() + 1 );
                $slide.attr( 'id', id + '_' + slideId );

                me.slides.push( new Slide( $slide,  opts ) );
                me.slidesCount = me.slides.length;
            });

            return me;
        },
        updateSlides: function() {
            var cur = this.currentSlide,
                classes = this.options.slidesClasses,
                clsStr = classes.join(' '), cls;

            $.each( this.slides, function( ind, slide ) {
                slide = slide.$elem.removeClass( clsStr );
                cls = classes[ ind - cur + 2 ];
                cls && slide.addClass( cls );
            });
        },

        previous: function() {
            return this.goTo( this.currentSlide - 1 );
        },
        goTo: function( i, notPush ) {
            var next = this.getSlide( i );
            if ( !next ) return null;

            this.currentSlide = next.index;
            this.updateSlides();

            this.$elem.trigger('onSlideChanged');
            !notPush && this._setState();

            return next;
        },
        next: function() {
            var curSlide = this.slides[ this.currentSlide ];
            if ( curSlide.steps.length ) {
                curSlide.doStep();
                return curSlide;
            }

            return this.goTo( this.currentSlide + 1 );
        },

        toggleTransition: function( mode ) {
            var currentMode = this.transition;
            console.log(currentMode, mode )
            if ( currentMode === mode ) return;

            if( mode === null ) mode = !currentMode;

            this.$elem
                .attr( 'data-transition', mode? 'On': 'Off' )
                .trigger('transitionToggled', mode);

            this.transition = mode;
        },

        changeStatus: function( status ) {
            var me = this;

            $.each( me.status, function( key ) {
                me.status[ key ] = key === status;
            });

            return me;
        },
        play: function() {
            clearTimeout( this.playTimeOut );

            var curSlide = this.slides[ this.currentSlide ] || this.goTo( 0 ),
                curStep  = curSlide.currentStep,
                callback = $.proxy( function() {
                    this.next();
                    this.play();
                }, this ),
                timer = curSlide.timer;

            if ( curSlide.steps.length ) {
                timer = ( curStep && curStep.timer ) || this.options.slide.stepTimer;
            }
            else if ( this.currentSlide === this.slidesCount - 1 ) {
                if( !this.status.playing ) return this.restart();

                callback = $.proxy( function() {
                    this.options.loopPlay? this.restart(): this.stop();
                }, this );
            }

            if ( !this.status.playing ) {
                this.$elem.trigger('onPlay');
                this.changeStatus('playing');
                this.defaults.onPlay();
            }
            this.playTimeOut = setTimeout( callback, timer );

            return this;
        },
        stop: function() {
            if ( !this.status.stopped ) {
                clearTimeout( this.playTimeOut );
                this.$elem.trigger('onStop');
                this.changeStatus('stopped');
                this.defaults.onStopt();
            }
            return this;
        },
        pause: function() {
            if ( !this.status.paused ) {
                clearTimeout( this.playTimeOut );
                this.$elem.trigger('onPause');
                this.changeStatus('paused');
                this.defaults.onPause();
            }
            return this;

        },
        restart: function() {
            this.goTo( 0 );
            this.play();
            this.$elem.trigger('onRestart');
            this.defaults.onRestart();

            return this;
        },

        getSlide: function( i ) {
            var index = false;

            if ( $.type( i ) === 'string' ) {
                $.each( this.slides, function( ind, slide ) {
                    if ( slide.id === i ) {
                        index = ind;
                        return false;
                    }
                });
            }

            if ( $.isNumeric( i ) ) index = ( i > -1 ) && ( i < this.slidesCount ) && i;
            else if ( !i ) index = this.currentSlide;

            return $.isNumeric( index )? this.slides[ index ]: null;
        },
        getSlideFromHash: function() {
            var me = this,
                hash = location.hash.substr(1);
            if ( hash === '' ) return false;

            var parts = hash.split('&'),
                slide = false;

            $.each( parts, function( ind, part ) {
                slide = me.getSlide( part );
                return !slide;
            });

            return slide;
        },

        _setState: function( update ) {
            var me = this,
                slide = me.slides[ me.currentSlide ];

            if ( !slide ) return;

            var slideId = slide.id,

                state = history.state || {},
                task = update ? 'replaceState' : 'pushState',

                hash = location.hash.substr(1),
                inHash = false;


            hash = hash == ''? []: hash.split('&');
            $.each( hash, function( ind, part ) {
                if ( part.split('_')[0] == me.id ) {
                    inHash = ind;
                    return false;
                }
            });

            if ( $.isNumeric( inHash ) ) hash[inHash] = slideId;
            else hash.push( slideId );

            hash = hash.join('&');
            state[ me.id ] = slideId;

            if ( history[ task ] ) history[ task ]( state, '', '#' + hash );
            else window.location.hash = hash;

            return me;
        },
        _onPopState: function( event ) {
            event = event.originalEvent || window.event;

            var inState = event.state && event.state[ this.id ],
                slide = inState? this.getSlide( inState ): this.getSlideFromHash();

            slide && this.goTo( slide.index, true );
            return this;
        },

        _keysHandler: function( event ) {
            var me = this, $elem = me.$elem;
            if ( /^(input|textarea)$/i.test(event.target.nodeName) || event.target.isContentEditable ) return;

            // check for mouseover state
            if ( !$elem.is('.focused') ) return;
            console.log(event.keyCode)
            switch ( event.keyCode ) {
                case 32: // space
                    me.status.playing? me.pause(): me.play();
                    break;

                case 37: // left arrow
                    me.previous();
                    break;
                case 39: // right arrow
                    me.next();
                    break;

                case 38: // up arrow
                    me.scale(false, 10);
                    break;
                case 40: // down arrow
                    me.scale(false, -10);
                    break;

                case 82: // R
                    me.toggleTransition(null);
                    break;

                case 84: // T
                    me.changeTheme();
                    break;

                case 122: // F11
                    event.preventDefault();
                    toggleFullScreen( $elem[0] );
                    break;
            }
        },

        _setScaleHandler: function() {
            var me = this,
                $el = me.$elem,

                em = parseInt( $('html').css('font-size') ),

                fs = me.slides[0].$elem,
                fs_w = parseInt( fs.width() + 2 * em ),
                rate = fs_w / ( fs.height() + 2 * em ).toFixed(0),

                scale = null, current = null;

            function updateVars() {
                var el_w = $el.width(),
                    el_h = $el.height(),
                    max_h = el_h,
                    max_w = ( el_h) * rate;

                if ( max_w > el_w ) {
                    max_w = el_w;
                    max_h = max_w / rate;
                }

                scale = max_w / fs_w;
            }
            updateVars();

            return function ( percent, delta ) {
                if ( !percent ) {
                    updateVars();
                    percent = current;
                }

                if ( delta ) percent += parseInt( delta );

                     if ( percent < 40 )  percent = 40;
                else if ( percent > 100 ) percent = 100;

                $el.css( 'font-size', ( percent * scale ).toFixed( 0 ) + '%');

                if ( current === percent ) return;

                current = percent;
                me.$elem.trigger('scaleChanged', current);
            }
        },
        _setThemeToggler: function() {
            var $el = this.$elem,
                opts = this.options,
                themes = opts.presentThemes,
                current = this.currentTheme || -1,
                initial = opts.initialTheme;

            return function changeTheme ( theme ) {

                console.log(current)
                if ( theme ) {
                    current = $.inArray( theme, themes );
                }
                else if ( !$.isNumeric(current) || current < 0 ) {
                    current = $.inArray( initial, themes );
                }
                else {
                    current += 1;
                }
                console.log(current)

                if ( current >= themes.length || current < 0 ) current = 0;

                $el.attr( 'data-theme', themes[ current ] );
                this.currentTheme = current;

                $el.trigger( 'themeChanged', themes[ current ] );

                //sessionStorage['theme'] = linkEls[(sheetIndex + 1) % linkEls.length].href;
            }
        },

        _addPrettify: function() {
            $('pre').addClass('prettyprint');
            $.getScript("javascripts/prettify.js", function() {
                prettyPrint()
            });
        },
        _addFontStyle: function() {
            $('body').append( $('<link/>', {
                rel: 'stylesheet',
                type:'text/css',
                href: 'http://fonts.googleapis.com/css?family=' +
                    'Open+Sans:regular,semibold,italic,italicsemibold|Droid+Sans+Mono'
            }));
        }

};


    var Scroll = function( elem, callback ) {
        var me = this,
            $elem = $( elem );

        $elem.append('<div class="ord"><span class="handler"></span></div> ');
        $elem.addClass('hideable');

        me.$elem   = $elem;
        me.$ord     = $elem.find('.ord');
        me.$handler = $elem.find('.handler');

        me.elemWidth    = parseInt( $elem.width() );
        me.ordWidth     = parseInt( me.$ord.width() );
        me.handlerWidth = parseInt( me.$handler.width() );

        me.min = parseInt( $elem.attr('min') );
        me.max = parseInt( $elem.attr('max') );
        me.step = ( me.ordWidth  ) / ( me.max - me.min );

        me.onChange = callback;

        $elem
            .on( me.setDragHandler() )
            .on( setWheelHandler( function ( dir ) { dir && me.setValue( me._value - dir * 10 ) } ) )
            .on( 'touchstart', touchHandler );

        me.setValue( parseInt( $elem.attr('value') ) );

        return me;
    };
    Scroll.prototype = {
        setDragHandler: function () {
            var me = this,
                ordOffset = parseInt( me.$ord.offset().left ),
                prop = ( me.max - me.min ) / me.ordWidth;

            function move( e ) {
                e.preventDefault();
                var val = ( ( parseInt( e.pageX ) - ordOffset ) * prop + me.min ).toFixed(1);
                if ( val > 95 && val < 110 ) val = 100;
                me.setValue( val );
            }

            function stop() {
                $( window ).off( 'mousemove touchmove', move );
                me.$elem.addClass( 'hideable' );
            }

            return {
                'mousedown': function( e ) {
                    e.preventDefault();

                    ordOffset = parseInt( me.$ord.offset().left );
                    me.$elem.removeClass( 'hideable' );

                    move( e );

                    $( window ).on({
                        'mousemove' : move,
                        'mouseup'   : stop,
                        'touchmove' : touchHandler,
                        'touchend'  : touchHandler
                    });
                }
            };
        },
        setValue: function( val ) {
            var me = this;
            val = Math.round( parseInt( val ) );

            if ( val > me.max ) val = me.max;
            else if ( val < me.min ) val = me.min;

            if ( val === me._value ) return;
            me.value = val;

            me.update();
            me.onChange && me.onChange( val );

            return me;
        },
        update: function() {
            var me = this,
                val =  Math.round( me.step * ( me.value - me.min ) );

            if ( val < 0 ) val = 0;
            else if ( val > me.ordWidth ) val = me.ordWidth;

            me.$handler.css( 'left', val - me.handlerWidth / 2 );
            return val;
        }
    };

    var Select = function( elem, description,  list, callback ) {
        var me = this,
            $elem = $( elem );

        var $selector = $('<div/>', { class: 'selector' }),
            $list = $('<ul/>', {
                class: 'list',
                html: $.map( list, function( item ) {
                    return $('<li/>', { text: item });
                })
            });

        $selector
            .attr( 'data-description', description )
            .on('mousedown', function() {
                $list.slideToggle();
            });

        $list.on('mousedown', 'li', function() {
            me.setValue( $(this).text() );
        });

        me.$selector = $selector;
        me.$list = $list;
        me.$items = $list.children('li');
        me.callback = callback || $.noop;
        me.value = null;

        $elem.append( $selector, $list );
        return me;
    };
    Select.prototype = {
        setValue: function( val ) {
            this.$list.slideUp();
            if ( this.value === val ) return;
            this.$selector.text( val );
            this.value = val;
            this.onChange();
        },
        onChange: function() {
            var me = this;
            me.callback( me.value );
            $.each( me.$items, function(i, item) {
                item = $( item );
                item.toggleClass('active', item.text() == me.value );
            });
        }
    };


    function setWheelHandler ( callback ) {
        return {
            'mousewheel wheel': function( event ) {
                event = event.originalEvent || window.event;

                var delta = event.deltaY || event.wheelDelta,
                    dir = false;

                dir = delta && ( delta > 0? 1: -1 );
                if ( event.wheelDelta ) dir *= -1;

                callback( dir );
            }
        }
    }
    function setTouchHandler ( callback ) {
        var startX = 0;
        return {
            touchend: function( e ) {
                e = e.originalEvent;
                var delta = startX - e.changedTouches[0].pageX,
                    swipe = 30, dir = false;

                if ( delta > swipe ) { dir = 1 }
                else if ( delta < -swipe ) { dir = -1 }

                callback( dir, delta );
            },
            touchstart: function( e ) {
                e = e.originalEvent;
                startX = e.touches[0].pageX;
            }

        }
    }
    function setWinResizeHandler ( callback, time ) {
        var timeout = null;
        $( window).on('resize', function() {
            if ( timeout ) clearTimeout( timeout );
            timeout = setTimeout( callback, time || 100 );
        });
    }
    function toggleFullScreen ( elem ) {
        elem = elem || document.documentElement;

        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.webkitCurrentFullScreenElement && !document.msFullScreenElement ) {

                 if (elem.requestFullscreen) { elem.requestFullscreen(); }
            else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT); }
            else if (elem.mozRequestFullScreen) { elem.mozRequestFullScreen(); }
            else if (elem.msRequestFullScreen) { elem.msRequestFullScreen(); }

            else if( typeof window.ActiveXObject != "undefined" ) {
                var wscript = new ActiveXObject("WScript.Shell");
                if ( wscript != null ) { wscript.SendKeys("{F11}"); }
                else {
                    alert('Настройки безопасности вашего браузера не позволяют программно включать полноэкранный режим.' +
                        '\n' +
                        '\nВы можете сделать это самостоятельно, нажав F11 на клавиатуре.' +
                        '\n' +
                        '\nДля того, чтобы изменить настройки безопасности, перейдите в' +
                        '\n"Инструменты" -> "Настройки обозревателя" -> "Безопасность"' +
                        '\nи нажмите кнопку "Другой...".' +
                        '\nВ открывшемся окне найдите параметр' +
                        '\n"Использование элементов управления ActiveX, не помеченных как безопасные для использования"' +
                        '\nи установите для него значение "Включить" или "Предлагать".' +
                        '\nПерезагрузите браузер, чтобы настройки вступили в действие.'
                    );
                }
            }
        } else {
                 if (document.exitFullscreen) { document.exitFullscreen(); }
            else if (document.webkitCancelFullScreen) { document.webkitCancelFullScreen(); }
            else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
            else if (document.mozCancelFullScreen) { document.mozCancelFullScreen(); }
            else if (document.msCancelFullScreen) { document.msCancelFullScreen(); }

            else if( typeof window.ActiveXObject != "undefined" ) {
                var wscript = new ActiveXObject("WScript.Shell");
                if ( wscript != null ) { wscript.SendKeys("{F11}"); }
            }
        }
    }
    function touchHandler (event) {
        event = event.originalEvent;
        var touches = event.changedTouches,
            first = touches[0],
            type = "";

        switch(event.type) {
            case "touchstart": type = "mousedown"; break;
            case "touchmove":  type = "mousemove"; break;
            case "touchend":   type = "mouseup"; break;
            default: return;
        }

        var simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(type, true, true, window, 1,
            first.screenX, first.screenY,
            first.clientX, first.clientY, false,
            false, false, false, 0/*left*/, null);

        first.target.dispatchEvent(simulatedEvent);
        event.preventDefault();
    }

    $.fn.makePresent = function ( options ) {
        this.each(function( ind, elem ) {
            new Present( elem, options )
        });
    }

} ( document, jQuery );


$(function() {
    $('.presentation').makePresent();
});
