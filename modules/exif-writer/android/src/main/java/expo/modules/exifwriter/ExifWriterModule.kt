package expo.modules.exifwriter

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import androidx.exifinterface.media.ExifInterface
import android.net.Uri
import java.io.File
import java.util.*

class ExifWriterModule : Module() {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ExifWriter')` in JavaScript.
    Name("ExifWriter")

    Function("writeExif") { uri: String, latitude : Double, longitude : Double, altitude : Double ->
      writeLocationExif(uri, latitude, longitude, altitude)
    }
  }

  private fun writeLocationExif(uri: String, latitude : Double, longitude : Double, altitude : Double): Boolean {
    try {
        val imageUri = Uri.parse(uri)
        val exifInterface = ExifInterface(imageUri.getPath().orEmpty())
        exifInterface.setLatLong(latitude, longitude)
        exifInterface.setAltitude(altitude)
        exifInterface.saveAttributes()
        return true
      } catch (e : Exception) {
        e.printStackTrace()
        return false
      }
  }
}
