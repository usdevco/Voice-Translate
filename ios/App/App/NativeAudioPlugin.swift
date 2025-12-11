import Foundation
import Capacitor
import AVFoundation

@objc(NativeAudioPlugin)
public class NativeAudioPlugin: CAPPlugin {
    private var player: AVAudioPlayer?

    @objc func play(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"),
              let data = Data(base64Encoded: base64) else {
            call.reject("Missing or invalid audio data")
            return
        }
        let mimeType = call.getString("mimeType") ?? "audio/mpeg"
        DispatchQueue.main.async { [weak self] in
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, options: [.defaultToSpeaker, .mixWithOthers])
                try AVAudioSession.sharedInstance().setActive(true)
                self?.player = try AVAudioPlayer(data: data, fileTypeHint: mimeType)
                self?.player?.prepareToPlay()
                self?.player?.play()
                call.resolve()
            } catch {
                call.reject("Native audio playback failed: \(error.localizedDescription)")
            }
        }
    }
}
