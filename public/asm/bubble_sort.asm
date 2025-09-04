; Bubble Sort - Sort an array using bubble sort algorithm
; This program demonstrates nested loops and array manipulation

.DATA
array: .WORD 64, 34, 25, 12, 22, 11, 90
len: .WORD 7

.TEXT
start:
    LOAD R0, [len]              ; Load array length
    MOV R1, R0                  ; Outer loop counter (n)
    
outer_loop:
    CMP R1, #1                  ; Check if outer loop done
    JLE sort_done               ; Exit if counter <= 1
    
    MOV R2, #0                  ; Inner loop index (i = 0)
    MOV R3, R1                  ; Inner loop limit (n-1)
    DEC R3                      ; Adjust for 0-based indexing
    
inner_loop:
    CMP R2, R3                  ; Check if inner loop done
    JGE inner_done              ; Exit inner loop if i >= n-1
    
    ; Calculate addresses for array[i] and array[i+1]
    MOV R4, R2                  ; Copy index i
    MUL R4, #4                  ; Convert to byte offset (i * 4)
    MOV R5, array               ; Base address
    ADD R4, R5                  ; Address of array[i]
    
    MOV R6, R4                  ; Copy address
    ADD R6, #4                  ; Address of array[i+1]
    
    ; Load values to compare
    LOAD R7, [R4]               ; array[i]
    LOAD R0, [R6]               ; array[i+1]
    
    ; Compare and swap if needed
    CMP R7, R0                  ; Compare array[i] with array[i+1]
    JLE no_swap                 ; Skip swap if array[i] <= array[i+1]
    
    ; Swap elements
    STORE [R4], R0              ; array[i] = array[i+1]
    STORE [R6], R7              ; array[i+1] = original array[i]
    
no_swap:
    INC R2                      ; i++
    JMP inner_loop              ; Continue inner loop
    
inner_done:
    DEC R1                      ; Decrement outer counter
    JMP outer_loop              ; Continue outer loop
    
sort_done:
    ; Print sorted array
    MOV R1, #0                  ; Index for printing
    LOAD R2, [len]              ; Array length
    
print_loop:
    CMP R1, R2                  ; Check if done printing
    JGE done                    ; Exit if all printed
    
    MOV R3, R1                  ; Copy index
    MUL R3, #4                  ; Convert to byte offset
    MOV R4, array               ; Base address
    ADD R3, R4                  ; Calculate element address
    LOAD R0, [R3]               ; Load element value
    
    SYS #1                      ; Print element
    INC R1                      ; Next element
    JMP print_loop              ; Continue
    
done:
    MOV R0, #0                  ; Exit code 0
    SYS #3                      ; Exit program
    HALT