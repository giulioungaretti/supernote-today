package com.supernotetoday

import android.os.Environment
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption

class TodayStorageModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "TodayStorage"

  @Suppress("DEPRECATION")
  private fun externalRoot(): File = Environment.getExternalStorageDirectory().canonicalFile

  private fun noteRoot(): File = File(externalRoot(), "Note").canonicalFile

  private fun stateDirectory(): File =
      File(externalRoot(), "Document/SupernoteToday").canonicalFile

  private fun stateFile(): File = File(stateDirectory(), "state.json")

  private fun requireNotePath(path: String): File {
    if (path.isBlank()) {
      throw IllegalArgumentException("Path must not be blank")
    }

    val candidate = File(path).canonicalFile
    val root = noteRoot()
    val rootPath = root.path
    val candidatePath = candidate.path
    val isInside = candidatePath == rootPath ||
        candidatePath.startsWith("$rootPath${File.separator}")

    if (!isInside) {
      throw SecurityException("Path must stay inside ${root.path}")
    }

    return candidate
  }

  private fun reject(promise: Promise, code: String, error: Throwable) {
    promise.reject(code, error.message ?: code, error)
  }

  @ReactMethod
  fun externalStorageRoot(promise: Promise) {
    try {
      promise.resolve(externalRoot().path)
    } catch (error: Throwable) {
      reject(promise, "E_TODAY_EXTERNAL_ROOT", error)
    }
  }

  @ReactMethod
  fun ensureDirectory(absolutePath: String, promise: Promise) {
    try {
      val directory = requireNotePath(absolutePath)
      val ready = directory.isDirectory || directory.mkdirs()
      if (!ready) {
        throw IllegalStateException("Could not create directory ${directory.path}")
      }
      promise.resolve(true)
    } catch (error: Throwable) {
      reject(promise, "E_TODAY_ENSURE_DIRECTORY", error)
    }
  }

  @ReactMethod
  fun exists(absolutePath: String, promise: Promise) {
    try {
      promise.resolve(requireNotePath(absolutePath).exists())
    } catch (error: Throwable) {
      reject(promise, "E_TODAY_EXISTS", error)
    }
  }

  @ReactMethod
  fun readState(promise: Promise) {
    try {
      val file = stateFile()
      promise.resolve(
          if (file.exists()) {
            file.readText(StandardCharsets.UTF_8)
          } else {
            null
          },
      )
    } catch (error: Throwable) {
      reject(promise, "E_TODAY_READ_STATE", error)
    }
  }

  @ReactMethod
  fun writeStateAtomic(json: String, promise: Promise) {
    val directory = stateDirectory()
    val target = stateFile()
    val temporary = File(directory, "state.json.tmp")

    try {
      if (json.toByteArray(StandardCharsets.UTF_8).size > MAX_STATE_BYTES) {
        throw IllegalArgumentException("State exceeds $MAX_STATE_BYTES bytes")
      }

      if (!directory.isDirectory && !directory.mkdirs()) {
        throw IllegalStateException("Could not create ${directory.path}")
      }

      FileOutputStream(temporary, false).use { stream ->
        stream.write(json.toByteArray(StandardCharsets.UTF_8))
        stream.flush()
        stream.fd.sync()
      }

      try {
        Files.move(
            temporary.toPath(),
            target.toPath(),
            StandardCopyOption.REPLACE_EXISTING,
            StandardCopyOption.ATOMIC_MOVE,
        )
      } catch (_: AtomicMoveNotSupportedException) {
        Files.move(
            temporary.toPath(),
            target.toPath(),
            StandardCopyOption.REPLACE_EXISTING,
        )
      }

      promise.resolve(true)
    } catch (error: Throwable) {
      if (temporary.exists()) {
        temporary.delete()
      }
      reject(promise, "E_TODAY_WRITE_STATE", error)
    }
  }

  private companion object {
    const val MAX_STATE_BYTES = 5 * 1024 * 1024
  }
}
