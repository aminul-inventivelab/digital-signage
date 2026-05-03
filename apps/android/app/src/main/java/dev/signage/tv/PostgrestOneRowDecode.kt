package dev.signage.tv

import io.github.jan.supabase.postgrest.result.PostgrestResult

/**
 * PostgREST returns `[{...}]` by default, but `single()` uses `Accept: application/vnd.pgrst.object+json`,
 * which returns `{...}`. supabase-kt's [PostgrestResult.decodeSingle] only accepts a JSON array.
 */
internal inline fun <reified T : Any> PostgrestResult.decodeOneRow(): T {
    val payload = data.trim()
    return if (payload.startsWith("[")) decodeSingle<T>() else decodeAs<T>()
}
