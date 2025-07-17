// Supabase Edge Function to monitor for petri observations that need splitting
// and trigger the image splitting process when new images are uploaded

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// Create a Supabase client with the Admin key (since we need full access)
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// This function would be set up with a cron schedule or database webhook trigger
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    console.log("Checking for petri observations that need splitting...");
    
    // Find all petri observations that:
    // 1. Are split source observations
    // 2. Have an image URL
    // 3. Have not been processed yet
    const { data: pendingObservations, error: findError } = await supabase
      .from("petri_observations")
      .select("*")
      .eq("is_split_source", true)
      .eq("split_processed", false)
      .not("image_url", "is", null);
      
    if (findError) {
      console.error("Error finding pending split observations:", findError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: findError.message 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    console.log(`Found ${pendingObservations?.length || 0} observations that need splitting`);
    
    // If there are no pending observations, return success
    if (!pendingObservations || pendingObservations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending split observations found", 
          count: 0 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    // Process each pending observation
    const results = [];
    
    for (const observation of pendingObservations) {
      console.log(`Triggering split processing for observation: ${observation.observation_id}`);
      
      try {
        // Call the process_split_petris function
        const processingResponse = await fetch(
          `${supabaseUrl}/functions/v1/process_split_petris`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ observationId: observation.observation_id })
          }
        );
        
        if (!processingResponse.ok) {
          const errorText = await processingResponse.text();
          console.error(`Failed to process observation ${observation.observation_id}:`, errorText);
          results.push({
            observation_id: observation.observation_id,
            status: "failed",
            error: `HTTP ${processingResponse.status}: ${errorText}`
          });
          continue;
        }
        
        const processingResult = await processingResponse.json();
        results.push({
          observation_id: observation.observation_id,
          status: processingResult.success ? "completed" : "failed",
          result: processingResult
        });
        
      } catch (error) {
        console.error(`Error processing observation ${observation.observation_id}:`, error);
        results.push({
          observation_id: observation.observation_id,
          status: "failed",
          error: error.message
        });
      }
    }
    
    // Calculate summary
    const completedCount = results.filter(r => r.status === "completed").length;
    const failedCount = results.filter(r => r.status === "failed").length;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${pendingObservations.length} observations`,
        summary: {
          total: pendingObservations.length,
          completed: completedCount,
          failed: failedCount
        },
        results 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unexpected error occurred" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});