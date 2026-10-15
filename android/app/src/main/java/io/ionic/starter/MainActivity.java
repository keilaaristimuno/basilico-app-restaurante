package io.ionic.starter;

import android.content.Intent;
import android.content.IntentSender;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.os.Bundle;
import android.os.SystemClock;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  // Margen para ignorar la salida cuando la propia app abre otra pantalla (cámara, escáner QR)
  private static final long MARGEN_SALIDA_PROPIA_MS = 1500;

  private SoundPool soundPool;
  private int sonidoCierre;
  private boolean sonidoCargado = false;
  private long ultimaSalidaPropia = 0;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    AudioAttributes atributos = new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build();

    soundPool = new SoundPool.Builder()
      .setMaxStreams(1)
      .setAudioAttributes(atributos)
      .build();

    soundPool.setOnLoadCompleteListener((pool, id, estado) -> sonidoCargado = estado == 0);
    sonidoCierre = soundPool.load(this, R.raw.cierre, 1);
  }

  /* Se llama cuando el usuario sale de la app por decisión propia (Home, recientes) */
  @Override
  protected void onUserLeaveHint() {
    super.onUserLeaveHint();

    boolean esSalidaPropia = SystemClock.elapsedRealtime() - ultimaSalidaPropia < MARGEN_SALIDA_PROPIA_MS;

    if (!esSalidaPropia && sonidoCargado && soundPool != null) {
      soundPool.play(sonidoCierre, 0.8f, 0.8f, 1, 0, 1f);
    }
  }

  /* Cuando la app abre otra actividad (cámara, escáner), no es una salida del usuario */
  @Override
  public void startActivity(Intent intent, Bundle options) {
    marcarSalidaPropia();
    super.startActivity(intent, options);
  }

  @Override
  public void startActivityForResult(Intent intent, int requestCode, Bundle options) {
    marcarSalidaPropia();
    super.startActivityForResult(intent, requestCode, options);
  }

  @Override
  public void startIntentSenderForResult(IntentSender intent, int requestCode, Intent fillInIntent,
                                         int flagsMask, int flagsValues, int extraFlags, Bundle options)
    throws IntentSender.SendIntentException {
    marcarSalidaPropia();
    super.startIntentSenderForResult(intent, requestCode, fillInIntent, flagsMask, flagsValues, extraFlags, options);
  }

  /* App.minimizeApp() (botón atrás) ya reproduce el sonido desde Angular: evita que suene dos veces */
  @Override
  public boolean moveTaskToBack(boolean nonRoot) {
    marcarSalidaPropia();
    return super.moveTaskToBack(nonRoot);
  }

  private void marcarSalidaPropia() {
    ultimaSalidaPropia = SystemClock.elapsedRealtime();
  }

  @Override
  public void onDestroy() {
    if (soundPool != null) {
      soundPool.release();
      soundPool = null;
    }
    super.onDestroy();
  }
}
