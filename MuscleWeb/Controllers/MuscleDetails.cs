using System.Collections.Generic;
/// <summary>
/// A class that represents the a single entry in the muscle search result.
/// </summary>
public class MuscleDetails
{
    /// <summary>
    /// Gets or sets the Id (non-medical) of the muscle.
    /// </summary>
    /// <returns></returns>
    public long Id { get; set; }

    /// <summary>
    /// Gets or sets the the attachment site that doesn't move during contraction.
    /// </summary>
    /// <returns></returns>
    public string Origo { get; set; }

    /// <summary>
    /// Gets or sets the attachment site that does move when the muscle contracts.
    /// </summary>
    /// <returns></returns>
    public string Insertio { get; set; }

    /// <summary>
    /// Gets or sets a description of the function of the muscle. 
    /// </summary>    
    public string Functio { get; set; }

    /// <summary>
    /// Gets or sets the Latin name of the muscle
    /// </summary>    
    public string LatinName { get; set; }

    /// <summary>
    /// Gets or sets the name of the muscle.
    /// </summary>    
    public string Name { get; set; }

    /// <summary>
    /// Gets or sets the image (filename) of the muscle.
    /// </summary>    
    public string Image { get; set; }

    /// <summary>
    /// Gets or sets the comment of the muscle.
    /// </summary>    
    public string Comment { get; set; }

    /// <summary>
    /// Gets or sets the vein id of the muscle.
    /// </summary>   
    public long Vein_Id { get; set; }

    /// <summary>
    /// Gets or sets the vein name of the muscle.
    /// </summary>  
    public string Vein { get; set; }

    /// <summary>
    /// Gets or sets the nerve id of the muscle.
    /// </summary>   
    public long Nerve_Id { get; set; }

    /// <summary>
    /// Gets or sets the nerve name of the muscle.
    /// </summary>  
    public string Nerve { get; set; }

    /// <summary>
    /// Gets or sets a list of arteries that supplies the muscle
    /// </summary>
    /// <returns></returns>  
    public ICollection<MuscleArtery> MuscleArteries { get; set; }

    /// <summary>
    /// Gets or sets a list of veins that drains the muscle
    /// </summary>
    /// <returns></returns>

    public ICollection<MuscleVein> MuscleVeins { get; set; }

    /// <summary>
    /// Gets or sets a list of nerves that supplies the muscle
    /// </summary>
    /// <returns></returns>

    public ICollection<MuscleNerve> MuscleNerves { get; set; }

    /// <summary>
    /// Gets or sets a list of muscle groups that represents the hierarchy of muscle groups 
    /// starting with the top level group as the first entry in the list.
    /// </summary>
    /// <returns></returns>
    public ICollection<MuscleGroup> MuscleGroups { get; set; }
}