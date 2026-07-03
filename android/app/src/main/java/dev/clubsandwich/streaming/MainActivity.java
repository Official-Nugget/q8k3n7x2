package dev.clubsandwich.streaming;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            // Let embedded players (trailers, streams) start without a tap —
            // on a TV there's no touch and the play button lives inside a
            // cross-origin iframe the remote can't reach.
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }
}
