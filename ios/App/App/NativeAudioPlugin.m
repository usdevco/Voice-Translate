#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeAudioPlugin, "NativeAudioPlugin",
           CAP_PLUGIN_METHOD(play, CAPPluginReturnPromise);
)
